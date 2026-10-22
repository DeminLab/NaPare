import { ConfigService } from '@nestjs/config';

export function deliveryEnabled(config?: ConfigService): boolean {
  const value = config?.get('NOTIFICATIONS_DELIVERY_ENABLED');
  return value === true || value === 'true';
}

export function queueEnabled(config: ConfigService): boolean {
  const value = config.get('NOTIFICATIONS_QUEUE_ENABLED');
  return value === true || value === 'true';
}
