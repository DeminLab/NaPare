export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  auth: {
    jwt: {
      secret: string;
      refreshSecret: string;
      accessExpiration: string;
      refreshExpiration: string;
    };
  };
  max: {
    botToken: string;
    initDataTtlSeconds: number;
  };
  telegram: {
    botToken: string;
    botUsername: string;
    webhookSecret: string;
    publicAppUrl: string;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveIntegerEnvironmentValue(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function nodeEnvironment(value: string | undefined): NodeEnvironment {
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  throw new Error('NODE_ENV must be one of: development, test, production');
}

export default (): AppConfig => ({
  nodeEnv: nodeEnvironment(process.env.NODE_ENV),
  auth: {
    jwt: {
      secret: requiredEnvironmentValue('JWT_SECRET'),
      refreshSecret: requiredEnvironmentValue('JWT_REFRESH_SECRET'),
      accessExpiration: requiredEnvironmentValue('JWT_ACCESS_EXPIRATION'),
      refreshExpiration: requiredEnvironmentValue('JWT_REFRESH_EXPIRATION'),
    },
  },
  max: {
    botToken: process.env.MAX_BOT_TOKEN?.trim() ?? '',
    initDataTtlSeconds: positiveIntegerEnvironmentValue('MAX_INIT_DATA_TTL_SECONDS', 900),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') ?? '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '',
    publicAppUrl: process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, '') ?? '',
  },
  rateLimit: {
    windowMs: positiveIntegerEnvironmentValue('RATE_LIMIT_WINDOW_MS', 60000),
    max: positiveIntegerEnvironmentValue('RATE_LIMIT_MAX', 100),
  },
});
