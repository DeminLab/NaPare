import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { request } from 'node:http';

@Injectable()
export class ControlAgentClient {
  constructor(private readonly config: ConfigService) {}
  configured() { return Boolean(this.config.get('PLATFORM_AGENT_SOCKET') && this.config.get('PLATFORM_AGENT_SECRET')); }
  async call<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
    const socketPath = this.config.get<string>('PLATFORM_AGENT_SOCKET');
    const secret = this.config.get<string>('PLATFORM_AGENT_SECRET');
    if (!socketPath || !secret || secret.length < 32) throw new ServiceUnavailableException('Управляющий процесс сервера ещё не подключён.');
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const timestamp = String(Date.now()), nonce = randomUUID();
    const signature = createHmac('sha256', secret).update([timestamp, nonce, method, path, createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
    return new Promise((resolve, reject) => {
      const req = request({ socketPath, path, method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-control-time': timestamp, 'x-control-nonce': nonce, 'x-control-signature': signature }, timeout: 10000 }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; if (data.length > 1048576) req.destroy(new Error('Agent response too large')); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!res.statusCode || res.statusCode >= 400) reject(new ServiceUnavailableException(parsed.message || 'Управляющий процесс отклонил запрос.'));
            else resolve(parsed);
          } catch { reject(new ServiceUnavailableException('Некорректный ответ управляющего процесса.')); }
        });
      });
      req.on('timeout', () => req.destroy(new Error('Agent timeout')));
      req.on('error', () => reject(new ServiceUnavailableException('Нет соединения с управляющим процессом сервера.')));
      req.end(body);
    });
  }
}
