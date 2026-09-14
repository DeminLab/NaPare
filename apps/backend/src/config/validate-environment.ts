import { NodeEnvironment } from './configuration';

const expirationPattern = /^(?:[1-9]\d*|[1-9]\d*[smhdwy])$/i;
const nodeEnvironments: NodeEnvironment[] = ['development', 'test', 'production'];

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];
  const nodeEnv = config.NODE_ENV;

  if (typeof nodeEnv !== 'string' || !nodeEnvironments.includes(nodeEnv as NodeEnvironment)) {
    errors.push('NODE_ENV must be one of: development, test, production');
  }

  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (typeof config[name] !== 'string' || config[name].trim().length === 0) {
      errors.push(`${name} is required`);
    }
  }

  for (const name of ['JWT_ACCESS_EXPIRATION', 'JWT_REFRESH_EXPIRATION']) {
    const value = config[name];
    if (typeof value !== 'string' || !expirationPattern.test(value)) {
      errors.push(`${name} must be a positive duration such as 15m or 30d`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return config;
}
