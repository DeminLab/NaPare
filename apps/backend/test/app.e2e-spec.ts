import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/ (GET)', () => {
    it('should redirect to /api/v1/docs', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(302)
        .expect('Location', '/api/v1/docs');
    });
  });

  describe('/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });

  describe('/app (GET)', () => {
    it('should return app info', () => {
      return request(app.getHttpServer())
        .get('/app')
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('НаПаре');
          expect(res.body.version).toBeDefined();
        });
    });
  });
});
