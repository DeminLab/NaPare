import * as request from 'supertest';

import { createCurationFixture } from './curation.fixture';
import { Invite } from '../src/invites/entities/invite.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { User } from '../src/users/entities/user.entity';
import { INVITE_UNIFORM_MESSAGE } from '../src/invites/invites.constants';

const suite = process.env.INVITES_TEST_DATABASE_URL ? describe : describe.skip;
suite('Onboarding invites, claim and linkage queue (TZ 9.2, FR-ONB-02/03/04, SEC-09)', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>;
  let adminToken = '';
  let studentToken = '';
  const http = () => request(f.app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

  const createInvite = async (email: string, factorValue: string) => {
    const response = await asAdmin(
      http().post('/api/v1/admin/invites').send({ email, factorType: 'student_card', factorValue }),
    ).expect(201);
    return response.body as { id: string; token: string; expiresAt: string };
  };

  beforeAll(async () => {
    f = await createCurationFixture(process.env.INVITES_TEST_DATABASE_URL!);
    const admin = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@curation.example.test', password: f.password })
      .expect(200);
    adminToken = admin.body.accessToken;
    const student = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'student@curation.example.test', password: f.password })
      .expect(200);
    studentToken = student.body.accessToken;
  }, 120000);

  afterAll(async () => {
    await f?.app.close();
  });

  it('serves only organization data on the public lookup and regenerates the link', async () => {
    const invite = await createInvite('student@curation.example.test', 'CARD-9911');

    const lookup = await http().get(`/api/v1/invites/${invite.token}`).expect(200);
    expect(lookup.body).toMatchObject({
      organizationName: 'Кураторство — тест',
      groupName: 'ИН-25',
      factorType: 'student_card',
    });
    expect(lookup.body.expectedFullName).toBeUndefined();
    expect(new Date(lookup.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const unknown = await http().get('/api/v1/invites/no-such-invite-token').expect(404);
    expect(unknown.body.code).toBe('NOT_FOUND');
    const regenerated = await asAdmin(
      http().post(`/api/v1/admin/invites/${invite.id}/regenerate`),
    ).expect(201);
    expect(regenerated.body.token).toBeDefined();
    expect(regenerated.body.token).not.toBe(invite.token);
    await http().get(`/api/v1/invites/${invite.token}`).expect(404);
    await http().get(`/api/v1/invites/${regenerated.body.token}`).expect(200);
  }, 60000);

  it('answers an unknown token claim and a wrong factor with one uniform 404', async () => {
    const invite = await createInvite('student@curation.example.test', 'CARD-2200');

    const unknown = await http()
      .post('/api/v1/invites/no-such-invite-token/claim')
      .send({ fullName: 'Анна Иванова', factorValue: 'CARD-2200' })
      .expect(404);
    const uniform = { code: 'NOT_FOUND', message: INVITE_UNIFORM_MESSAGE };
    expect({ code: unknown.body.code, message: unknown.body.message }).toEqual(uniform);

    const wrongFactor = await http()
      .post(`/api/v1/invites/${invite.token}/claim`)
      .send({ fullName: 'Анна Иванова', factorValue: 'WRONG-FACTOR' })
      .expect(404);
    expect({ code: wrongFactor.body.code, message: wrongFactor.body.message }).toEqual(uniform);

    const wrongName = await http()
      .post(`/api/v1/invites/${invite.token}/claim`)
      .send({ fullName: 'Чужой Человек', factorValue: 'CARD-2200' })
      .expect(404);
    expect({ code: wrongName.body.code, message: wrongName.body.message }).toEqual(uniform);
  }, 60000);

  it('locks the invite at the attempt limit with LINK_ATTEMPTS_EXCEEDED and alerts staff', async () => {
    const invite = await createInvite('student@curation.example.test', 'CARD-3300');
    const wrong = { fullName: 'Анна Иванова', factorValue: 'STILL-WRONG' };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const rejection = await http().post(`/api/v1/invites/${invite.token}/claim`).send(wrong).expect(404);
      expect(rejection.body.code).toBe('NOT_FOUND');
    }
    const limited = await http().post(`/api/v1/invites/${invite.token}/claim`).send(wrong).expect(429);
    expect(limited.body.code).toBe('LINK_ATTEMPTS_EXCEEDED');

    const alerts = await f.db.getRepository(Notification).find({
      where: { organizationId: f.uni.id, type: 'system' },
    });
    expect(alerts.some(notification => notification.title.includes('Подозрительная активность'))).toBe(true);

    const stored = await f.db.getRepository(Invite).findOne({ where: { id: invite.id } });
    expect(stored?.attempts).toBe(stored?.maxAttempts);
  }, 60000);

  it('activates a pending student, issues tokens and consumes the invite', async () => {
    const invite = await createInvite('blocked@curation.example.test', 'CARD-4400');

    const claimed = await http()
      .post(`/api/v1/invites/${invite.token}/claim`)
      .send({ fullName: 'Пётр Волков', factorValue: 'CARD-4400' })
      .expect(200);
    expect(claimed.body.accessToken).toBeDefined();
    expect(claimed.body.refreshToken).toBeDefined();
    expect(claimed.body.user.id).toBe(f.users.blocked.id);

    const profile = await http()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${claimed.body.accessToken}`)
      .expect(200);
    expect(profile.body.role).toBe('student');
    const activated = await f.db.getRepository(User).findOne({ where: { id: f.users.blocked.id } });
    expect(activated?.isActive).toBe(true);

    const reused = await http()
      .post(`/api/v1/invites/${invite.token}/claim`)
      .send({ fullName: 'Пётр Волков', factorValue: 'CARD-4400' })
      .expect(404);
    expect({ code: reused.body.code, message: reused.body.message }).toEqual({
      code: 'NOT_FOUND',
      message: INVITE_UNIFORM_MESSAGE,
    });
  }, 60000);

  it('answers expired invites with INVITE_EXPIRED', async () => {
    const invite = await createInvite('student@curation.example.test', 'CARD-5500');
    await f.db.query(`UPDATE invite SET "expiresAt" = now() - interval '1 day' WHERE id = $1`, [invite.id]);

    const expired = await http().get(`/api/v1/invites/${invite.token}`).expect(404);
    expect(expired.body.code).toBe('INVITE_EXPIRED');
    const claim = await http()
      .post(`/api/v1/invites/${invite.token}/claim`)
      .send({ fullName: 'Анна Иванова', factorValue: 'CARD-5500' })
      .expect(404);
    expect(claim.body.code).toBe('INVITE_EXPIRED');
  }, 60000);

  it('accepts uniform link requests and lets staff decide them once', async () => {
    const known = await http()
      .post('/api/v1/link-requests')
      .send({ studentEmail: 'student@curation.example.test', studentFullName: 'Анна Иванова', note: 'Ссылка не открывается' })
      .expect(201);
    expect(known.body).toEqual({ status: 'pending' });

    const unknownEmail = await http()
      .post('/api/v1/link-requests')
      .send({ studentEmail: 'ghost@nowhere.test', studentFullName: 'Призрак Неизвестный' })
      .expect(201);
    expect(known.body).toEqual(unknownEmail.body);

    const queue = await asAdmin(http().get('/api/v1/admin/link-requests')).expect(200);
    expect(queue.body).toHaveLength(1);
    const entry = queue.body[0];
    expect(entry.studentEmail).toBe('student@curation.example.test');
    expect(entry.status).toBe('pending');

    const rejected = await asAdmin(
      http().patch(`/api/v1/admin/link-requests/${entry.id}`).send({ status: 'rejected', note: 'Нет подтверждения' }),
    ).expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.decidedBy).toBeDefined();

    await asAdmin(
      http().patch(`/api/v1/admin/link-requests/${entry.id}`).send({ status: 'approved' }),
    ).expect(409);
    await asAdmin(
      http().patch('/api/v1/admin/link-requests/00000000-0000-4000-8000-0000000000ff').send({ status: 'approved' }),
    ).expect(404);
  }, 60000);

  it('lists invites to staff without secret columns and guards the staff surface', async () => {
    const list = await asAdmin(http().get('/api/v1/admin/invites')).expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(3);
    for (const item of list.body) {
      expect(item.tokenHash).toBeUndefined();
      expect(item.factorHash).toBeUndefined();
      expect(item.token).toBeUndefined();
    }

    await http().get('/api/v1/admin/invites').expect(401);
    await http()
      .get('/api/v1/admin/invites')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
    await http()
      .post('/api/v1/admin/invites')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ email: 'student@curation.example.test', factorType: 'student_card', factorValue: 'CARD-9999' })
      .expect(403);
  }, 60000);
});
