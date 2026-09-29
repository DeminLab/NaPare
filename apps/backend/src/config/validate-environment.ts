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

  const telegramSecrets = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET'];
  const configuredTelegramSecrets = telegramSecrets.filter(name => typeof config[name] === 'string' && (config[name] as string).trim());
  if (configuredTelegramSecrets.length > 0 && configuredTelegramSecrets.length !== telegramSecrets.length) {
    errors.push('TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET must be configured together');
  }
  if (configuredTelegramSecrets.length === telegramSecrets.length && !(typeof config.PUBLIC_APP_URL === 'string' && config.PUBLIC_APP_URL.trim())) {
    errors.push('PUBLIC_APP_URL is required when Telegram bot credentials are configured');
  }
  if (typeof config.TELEGRAM_BOT_USERNAME === 'string' && config.TELEGRAM_BOT_USERNAME.trim() && !/^[A-Za-z0-9_]{5,32}$/.test(config.TELEGRAM_BOT_USERNAME.trim().replace(/^@/, ''))) {
    errors.push('TELEGRAM_BOT_USERNAME must be a valid Telegram bot username without @');
  }
  if (typeof config.TELEGRAM_WEBHOOK_SECRET === 'string' && config.TELEGRAM_WEBHOOK_SECRET.trim() && !/^[A-Za-z0-9_-]{32,256}$/.test(config.TELEGRAM_WEBHOOK_SECRET.trim())) {
    errors.push('TELEGRAM_WEBHOOK_SECRET must contain 32-256 characters: A-Z, a-z, 0-9, _ or -');
  }
  if (typeof config.PUBLIC_APP_URL === 'string' && config.PUBLIC_APP_URL.trim()) {
    try {
      const publicAppUrl = new URL(config.PUBLIC_APP_URL.trim());
      if (publicAppUrl.protocol !== 'https:' || publicAppUrl.pathname !== '/' || publicAppUrl.search || publicAppUrl.hash) {
        errors.push('PUBLIC_APP_URL must be an HTTPS origin without path, query or fragment');
      }
    } catch {
      errors.push('PUBLIC_APP_URL must be a valid HTTPS origin');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return config;
}
