import * as request from 'supertest';
import { createCurationFixture } from './curation.fixture';
import { CareerCompany, CareerMembership, CareerPartnership, CareerProfile } from '../src/career/career.entities';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/auth/interfaces/user-role';
import { PersonalDataRead1700000000037 } from '../src/migrations/1700000000037-PersonalDataRead';
import { AccountErasure1700000000038 } from '../src/migrations/1700000000038-AccountErasure';
import { CareerModeration1700000000040 } from '../src/migrations/1700000000040-CareerModeration';

const suite = process.env.CAREER_JOURNEY_TEST_DATABASE_URL ? describe : describe.skip;
jest.setTimeout(90000);

/**
 * One continuous journey through the career center: profile, admission, task,
 * application, work, revision, acceptance, review, portfolio and notices.
 * Every step is a real HTTP call with a real JWT against PostgreSQL, so the
 * order of the state machine is verified end to end, not per service method.
 */
suite('Career center student journey with real JWT/PostgreSQL', () => {
  let f: Awaited<ReturnType<typeof createCurationFixture>>, companyId: string;
  const tokens: Record<string, string> = {};
  let ip = 0;
  const http = () => request(f.app.getHttpServer());
  const post = (path: string, actor: string, body: object = {}) => http().post('/api/v1/career/' + path).auth(tokens[actor], { type: 'bearer' }).set('X-Forwarded-For', `192.0.2.${++ip}`).send(body);
  const get = (path: string, actor: string) => http().get('/api/v1/career/' + path).auth(tokens[actor], { type: 'bearer' });
  const patch = (path: string, actor: string, body: object = {}) => http().patch('/api/v1/career/' + path).auth(tokens[actor], { type: 'bearer' }).send(body);
  const put = (path: string, actor: string, body: object = {}) => http().put('/api/v1/career/' + path).auth(tokens[actor], { type: 'bearer' }).send(body);

  beforeAll(async () => {
    f = await createCurationFixture(process.env.CAREER_JOURNEY_TEST_DATABASE_URL!);
    f.app.getHttpAdapter().getInstance().set('trust proxy', true);
    const runner = f.db.createQueryRunner();
    try {
      await new PersonalDataRead1700000000037().up(runner);
      await new AccountErasure1700000000038().up(runner);
      await new CareerModeration1700000000040().up(runner);
    } finally { await runner.release(); }

    const employer = await f.db.getRepository(User).save({ email: 'journey-employer@example.test', firstName: 'Синтетический', lastName: 'Работодатель', passwordHash: f.users.student.passwordHash, role: UserRole.EMPLOYER, organizationId: null });
    companyId = (await f.db.getRepository(CareerCompany).save({ name: 'Синтетическая студия', createdBy: employer.id })).id;
    await f.db.getRepository(CareerMembership).save({ userId: employer.id, companyId, organizationId: null, role: 'company_owner' });
    await f.db.getRepository(CareerPartnership).save({ companyId, organizationId: f.uni.id, state: 'verified' });

    for (const actor of ['employer', 'student', 'peer', 'admin']) {
      const user = actor === 'employer' ? employer : f.users[actor];
      const login = await http().post('/api/v1/auth/login').send({ email: user.email, password: f.password }).expect(200);
      tokens[actor] = login.body.accessToken;
    }
  });
  afterAll(async () => { await f?.app.close(); });

  const draft = (extra: object = {}) => ({ companyId, organizationId: f.uni.id, title: 'Макет карьерного центра', description: 'Подготовить доступный макет страницы карьерного центра для согласования', criteria: 'Передать исходники и размеры макета', requirements: '', level: 'standard', rewardKopecks: 100000, hours: 10, deadline: '2099-12-01', profiled: true, skill: 'design', ...extra });

  let profileId = '', admissionId = '', taskId = '', applicationId = '', workId = '';

  it('starts with a pending profile and no access to a profiled task', async () => {
    const profile = await put('profile', 'student', { headline: 'Продуктовый дизайнер', about: 'Макеты и прототипы', skills: ['design'] }).expect(200);
    profileId = profile.body.id;
    expect(profile.body.verification).toBe('pending');

    taskId = (await post('tasks', 'employer', draft()).expect(201)).body.id;
    await post(`tasks/${taskId}/publish`, 'employer').expect(201);
    await post(`tasks/${taskId}/approve`, 'admin').expect(201);

    await post(`tasks/${taskId}/apply`, 'student', { message: 'Готов сделать макет страницы' }).expect(403);
    await post(`tasks/${taskId}/apply`, 'peer', { message: 'Тоже готов сделать макет' }).expect(403);
  });

  it('needs both a verified profile and an admission for a profiled task', async () => {
    await post('admissions', 'student', { skill: 'design', evidence: 'Три учебных макета в Figma' }).expect(201);
    const queues = await get('center/reviews?kind=admissions', 'admin').expect(200);
    admissionId = queues.body.items[0].id;

    expect((await post(`profiles/${profileId}/verify`, 'admin', { decision: 'approved', reason: 'Портфолио проверено' }).expect(201)).body.verification).toBe('verified');
    await post(`tasks/${taskId}/apply`, 'student', { message: 'Готов сделать макет страницы' }).expect(403);

    expect((await post(`admissions/${admissionId}/decision`, 'admin', { decision: 'approved', reason: 'Работы соответствуют направлению' }).expect(201)).body.state).toBe('approved');
    expect((await post(`tasks/${taskId}/apply`, 'student', { message: 'Готов сделать макет страницы' }).expect(201)).body.state).toBe('pending');
    await post(`tasks/${taskId}/apply`, 'student', { message: 'Повторный отклик на ту же задачу' }).expect(409);
  });

  it('assigns the task, requests a revision and accepts the reworked result', async () => {
    const workflows = await get('workflows?workspace=employer&kind=applications', 'employer').expect(200);
    applicationId = workflows.body.items[0].id;

    workId = (await post(`applications/${applicationId}/select`, 'employer').expect(201)).body.id;
    expect((await get('tasks?workspace=employer', 'employer').expect(200)).body.total).toBe(1);

    await post(`works/${workId}/submit`, 'student', { submission: 'Первая версия макета со всеми экранами', resultUrl: '' }).expect(201);
    await post(`works/${workId}/decision`, 'employer', { decision: 'revision', reason: '' }).expect(400);
    expect((await post(`works/${workId}/decision`, 'employer', { decision: 'revision', reason: 'Добавьте состояние ошибки' }).expect(201)).body.state).toBe('revision');

    await post(`works/${workId}/submit`, 'student', { submission: 'Вторая версия макета с состоянием ошибки', resultUrl: 'https://example.test/mockup' }).expect(201);
    expect((await post(`works/${workId}/decision`, 'employer', { decision: 'accepted', reason: 'Принято без замечаний' }).expect(201)).body.state).toBe('accepted');
  });

  it('keeps the portfolio private until the employer allows publication', async () => {
    await post(`works/${workId}/review`, 'employer', { rating: 5, body: 'Аккуратный и понятный макет', publishAllowed: false }).expect(201);
    const portfolio = await get('student/portfolio', 'student').expect(200);
    const item = portfolio.body.items[0].portfolio;
    await patch(`portfolio/${item.id}`, 'student', { published: true }).expect(403);

    await f.db.query('UPDATE career_review SET "publishAllowed" = true WHERE "workId" = $1', [workId]);
    expect((await patch(`portfolio/${item.id}`, 'student', { published: true }).expect(200)).body.published).toBe(true);
    expect((await http().get(`/api/v1/career/accounts/portfolio/${f.users.student.id}`).expect(200)).body.cases).toHaveLength(1);

    // The portal reads the paged endpoint anonymously; row security must let
    // exactly the published student and task through, and nothing else.
    const cases = await http().get(`/api/v1/career/accounts/portfolio/${f.users.student.id}/cases`).expect(200);
    expect(cases.body).toMatchObject({ total: 1, hasMore: false });
    expect(cases.body.cases[0]).toMatchObject({
      task: { title: 'Макет карьерного центра', skill: 'design', company: { name: 'Синтетическая студия' } },
      review: { rating: 5, body: 'Аккуратный и понятный макет' },
    });
    await http().get(`/api/v1/career/accounts/portfolio/${f.users.peer.id}/cases`).expect(404);
  });

  it('shows the whole journey in the student cabinet and notices', async () => {
    const overview = await get('', 'student').expect(200);
    expect(overview.body.mode).toBe('student');
    expect(overview.body.counts.portfolios).toBe(1);
    expect(overview.body.counts.works).toBe(1);

    const notices = await get('notices', 'student').expect(200);
    const titles = notices.body.items.map((notice: { title: string }) => notice.title).join(' ');
    expect(titles).toContain('Вы выбраны исполнителем');
    expect(titles).toContain('Работа принята');

    const saved = await f.db.getRepository(CareerProfile).findOneBy({ studentId: f.users.student.id });
    expect(saved?.verification).toBe('verified');
  });
});
