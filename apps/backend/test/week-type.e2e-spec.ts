import * as request from 'supertest';

import { createCurationFixture } from './curation.fixture';
import { AcademicTerm } from '../src/schedule/entities/academic-term.entity';
import { CalendarException } from '../src/schedule/entities/calendar-exception.entity';

const suite = process.env.WEEK_TYPE_TEST_DATABASE_URL ? describe : describe.skip;

/** TZ 9.3/11.3 acceptance: `GET /schedule/week-type` serves the control set of 11.3. */
suite('GET /schedule/week-type: academic calendar of the organization', () => {
  let fixture: Awaited<ReturnType<typeof createCurationFixture>>;
  let token: string;
  const http = () => request(fixture.app.getHttpServer());
  const weekType = (date: string) => http()
    .get('/api/v1/schedule/week-type')
    .query({ date })
    .auth(token, { type: 'bearer' });

  beforeAll(async () => {
    fixture = await createCurationFixture(process.env.WEEK_TYPE_TEST_DATABASE_URL!);
    await fixture.db.getRepository(AcademicTerm).save({
      organizationId: fixture.uni.id,
      startsOn: '2026-09-01',
      endsOn: '2027-01-31',
      cycleLength: 2,
      week1Anchor: '2026-09-07',
      week1Type: 'odd',
    });
    // A foreign calendar with the opposite rule must never leak into answers.
    await fixture.db.getRepository(AcademicTerm).save({
      organizationId: fixture.otherUni.id,
      startsOn: '2026-09-01',
      endsOn: '2027-01-31',
      cycleLength: 2,
      week1Anchor: '2026-09-08',
      week1Type: 'even',
    });
    const login = await http().post('/api/v1/auth/login')
      .send({ email: fixture.users.student.email, password: fixture.password })
      .expect(200);
    token = login.body.accessToken;
  }, 90000);

  it('requires authentication', async () => {
    await http().get('/api/v1/schedule/week-type').query({ date: '2026-10-23' }).expect(401);
  });

  it.each([
    { date: '2026-09-07', weekNumber: 1, cyclePosition: 1, weekType: 'odd' },
    { date: '2026-10-19', weekNumber: 7, cyclePosition: 1, weekType: 'odd' },
    { date: '2026-10-23', weekNumber: 7, cyclePosition: 1, weekType: 'odd' },
    { date: '2026-10-26', weekNumber: 8, cyclePosition: 2, weekType: 'even' },
    { date: '2026-10-27', weekNumber: 8, cyclePosition: 2, weekType: 'even' },
  ])('answers the TZ 11.3 control set: $date → week $weekNumber, $weekType', async ({ date, weekNumber, cyclePosition, weekType: expectedType }) => {
    const response = await weekType(date).expect(200);
    expect(response.body).toMatchObject({ date, weekNumber, cyclePosition, weekType: expectedType, cycleLength: 2 });
    expect(response.body.term).toMatchObject({ week1Anchor: '2026-09-07', week1Type: 'odd' });
    expect(response.body.exception).toBeNull();
  });

  it('returns the Monday..Sunday boundaries of the week', async () => {
    const response = await weekType('2026-10-23').expect(200);
    expect(response.body).toMatchObject({ weekStart: '2026-10-19', weekEnd: '2026-10-25' });
  });

  it('applies a manual date exception over the semester rule', async () => {
    await fixture.db.getRepository(CalendarException).save({
      organizationId: fixture.uni.id,
      exceptionDate: '2026-11-02',
      weekType: 'even',
      kind: 'holiday',
      note: 'перенос пар',
    });
    // 2026-11-02 is the Monday of week 9 (odd); the manual override wins.
    const response = await weekType('2026-11-02').expect(200);
    expect(response.body).toMatchObject({ weekNumber: 9, weekType: 'even' });
    expect(response.body.exception).toMatchObject({ kind: 'holiday', weekType: 'even' });
  });

  it('keeps the parity for an informational exception without an explicit weekType', async () => {
    await fixture.db.getRepository(CalendarException).save({
      organizationId: fixture.uni.id,
      exceptionDate: '2026-11-16',
      kind: 'vacation',
      note: 'каникулы',
    });
    // 2026-11-16 is the Monday of week 11 (odd): vacations never shift parity.
    const response = await weekType('2026-11-16').expect(200);
    expect(response.body).toMatchObject({ weekNumber: 11, weekType: 'odd' });
    expect(response.body.exception).toMatchObject({ kind: 'vacation', weekType: null });
  });

  it('rejects a date outside the active academic calendar', async () => {
    await weekType('2028-05-01').expect(404);
  });

  it('never serves another organization’s calendar', async () => {
    // The foreign term (anchor 2026-09-08, even) still covers the date:
    // a 404 here proves the lookup is scoped to the caller's organization.
    await fixture.db.getRepository(AcademicTerm).delete({ organizationId: fixture.uni.id });
    await weekType('2026-10-23').expect(404);
  });
});
