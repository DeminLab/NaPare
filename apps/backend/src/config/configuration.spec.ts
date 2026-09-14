import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';

import configuration, { AppConfig } from './configuration';
import { validateEnvironment } from './validate-environment';

const jwtEnvironment = {
  NODE_ENV: 'production',
  JWT_SECRET: 'access-secret-for-tests',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
  JWT_ACCESS_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION: '30d',
};

describe('environment configuration', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('starts with a valid JWT configuration', async () => {
    Object.assign(process.env, jwtEnvironment);

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          cache: true,
          load: [configuration],
          validate: validateEnvironment,
        }),
      ],
    }).compile();

    const config = module.get<ConfigService<AppConfig & Record<string, unknown>>>(ConfigService);
    expect(config.getOrThrow<string>('auth.jwt.secret')).toBe(jwtEnvironment.JWT_SECRET);
    expect(config.getOrThrow<string>('auth.jwt.refreshSecret')).toBe(
      jwtEnvironment.JWT_REFRESH_SECRET,
    );
  });

  it('fails when JWT_SECRET is missing', () => {
    const missingAccessSecret: Record<string, unknown> = { ...jwtEnvironment };
    delete missingAccessSecret.JWT_SECRET;

    expect(() => validateEnvironment(missingAccessSecret)).toThrow(
      'JWT_SECRET is required',
    );
  });

  it('fails when JWT_REFRESH_SECRET is missing', () => {
    const missingRefreshSecret: Record<string, unknown> = { ...jwtEnvironment };
    delete missingRefreshSecret.JWT_REFRESH_SECRET;

    expect(() => validateEnvironment(missingRefreshSecret)).toThrow(
      'JWT_REFRESH_SECRET is required',
    );
  });
});
