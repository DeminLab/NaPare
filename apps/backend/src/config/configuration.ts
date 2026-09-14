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
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
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
});
