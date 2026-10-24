import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { LookupAddress, LookupOptions } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

// Node compares IPv4 addresses with IPv4-mapped IPv6 rules. Keep the families
// separate so blocking ::ffff:0:0/96 does not also reject every public IPv4 host.
const blockedMoodleIpv4Addresses = new BlockList();
const blockedMoodleIpv6Addresses = new BlockList();
const globalMoodleIpv6Addresses = new BlockList();
globalMoodleIpv6Addresses.addSubnet("2000::", 3, "ipv6");
for (const [subnet, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedMoodleIpv4Addresses.addSubnet(subnet, prefix, "ipv4");
}
for (const [subnet, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::", 96],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedMoodleIpv6Addresses.addSubnet(subnet, prefix, "ipv6");
}

export interface MoodleConnectionConfig {
  baseUrl: string;
  encryptedToken: string;
  tokenIv: string;
  tokenTag: string;
}

export interface MoodleConnectionInfo {
  siteName: string | null;
  userName: string | null;
  release: string | null;
}

@Injectable()
export class MoodleConnectorService {
  configure(baseUrl: string, token: string): MoodleConnectionConfig {
    const normalizedBaseUrl = normalizeMoodleBaseUrl(baseUrl);
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encryptedToken = Buffer.concat([
      cipher.update(token.trim(), "utf8"),
      cipher.final(),
    ]);

    return {
      baseUrl: normalizedBaseUrl,
      encryptedToken: encryptedToken.toString("base64"),
      tokenIv: iv.toString("base64"),
      tokenTag: cipher.getAuthTag().toString("base64"),
    };
  }

  async testConnection(
    config: MoodleConnectionConfig,
  ): Promise<MoodleConnectionInfo> {
    const body = await this.requestApi(config, "core_webservice_get_site_info");
    return { siteName: stringOrNull(body.sitename), userName: stringOrNull(body.username), release: stringOrNull(body.release) };
  }

  async getCalendarEvents(config: MoodleConnectionConfig, groupIds: number[], from: number, to: number): Promise<Record<string, unknown>[]> {
    if (!groupIds.length || groupIds.length > 100 || groupIds.some(id => !Number.isSafeInteger(id) || id < 1) || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to <= from || to - from > 366 * 86400) throw new BadRequestException('Moodle calendar: нужны группы и диапазон не больше 366 дней.');
    const parameters: Record<string, string> = { 'options[userevents]': '0', 'options[siteevents]': '0', 'options[ignorehidden]': '1', 'options[timestart]': String(from), 'options[timeend]': String(to) };
    groupIds.forEach((id, index) => { parameters[`events[groupids][${index}]`] = String(id); });
    const body = await this.requestApi(config, 'core_calendar_get_calendar_events', parameters);
    if (!Array.isArray(body.events) || body.events.length > 1000 || (Array.isArray(body.warnings) && body.warnings.length)) throw new BadGatewayException('Moodle calendar: неполная выдача, предупреждения или больше 1000 событий.');
    if (body.events.some(event => !event || typeof event !== 'object' || Array.isArray(event))) throw new BadGatewayException('Moodle calendar: неверный формат событий.');
    return body.events as Record<string, unknown>[];
  }

  async getUserCourses(config: MoodleConnectionConfig, userId: number): Promise<Record<string, unknown>[]> {
    if (!Number.isSafeInteger(userId) || userId < 1) throw new BadRequestException('Нужен числовой ID пользователя Moodle.');
    const body = await this.requestApi(config, 'core_enrol_get_users_courses', { userid: String(userId) });
    if (!Array.isArray(body.courses) || body.courses.length > 1000 || body.courses.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new BadGatewayException('Moodle вернул некорректный список курсов.');
    return body.courses as Record<string, unknown>[];
  }

  async getUserGradeItems(config: MoodleConnectionConfig, userId: number, courseId: number): Promise<Record<string, unknown>[]> {
    if (![userId, courseId].every(id => Number.isSafeInteger(id) && id > 0)) throw new BadRequestException('Нужны числовые ID Moodle.');
    const body = await this.requestApi(config, 'gradereport_user_get_grade_items', { userid: String(userId), courseid: String(courseId) });
    if (!Array.isArray(body.usergrades) || body.usergrades.length > 1 || (body.warnings !== undefined && (!Array.isArray(body.warnings) || body.warnings.length))) throw new BadGatewayException('Moodle вернул неполный или неоднозначный отчёт оценок.');
    if (!body.usergrades.length) return [];
    const report = body.usergrades[0] as Record<string, unknown> | null;
    if (!report || report.userid !== userId || report.courseid !== courseId || !Array.isArray(report.gradeitems) || report.gradeitems.length > 1000 || report.gradeitems.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new BadGatewayException('Отчёт Moodle не соответствует запрошенному студенту и курсу.');
    return report.gradeitems as Record<string, unknown>[];
  }

  private async requestApi(config: MoodleConnectionConfig, functionName: string, parameters: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const endpoint = new URL(
      "webservice/rest/server.php",
      normalizeMoodleBaseUrl(config.baseUrl),
    );
    endpoint.searchParams.set("wstoken", this.decryptToken(config));
    endpoint.searchParams.set("wsfunction", functionName);
    endpoint.searchParams.set("moodlewsrestformat", "json");
    for (const [key, value] of Object.entries(parameters)) endpoint.searchParams.set(key, value);

    const hostname = endpoint.hostname.replace(/^\[|\]$/g, "");
    let addresses: LookupAddress[];
    try {
      addresses = await dnsLookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new BadGatewayException(
        "Не удалось определить публичный адрес Moodle.",
      );
    }
    if (
      addresses.length === 0 ||
      addresses.some(({ address, family }) =>
        isIP(address) !== family ||
        (family === 4 ? blockedMoodleIpv4Addresses : blockedMoodleIpv6Addresses)
          .check(address, family === 4 ? "ipv4" : "ipv6") ||
        (family === 6 && !globalMoodleIpv6Addresses.check(address, "ipv6")),
      )
    ) {
      throw new BadRequestException(
        "Адрес Moodle должен разрешаться только в публичные IP-адреса.",
      );
    }

    const response = await requestPinnedMoodleEndpoint(endpoint, addresses);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new BadGatewayException(`Moodle вернул HTTP ${response.statusCode}.`);
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(response.body);
      if (Array.isArray(parsed) && functionName === 'core_enrol_get_users_courses') return { courses: parsed };
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid Moodle response");
      }
      body = parsed as Record<string, unknown>;
    } catch {
      throw new BadGatewayException("Moodle вернул некорректный ответ.");
    }
    if (
      typeof body.exception === "string" ||
      typeof body.errorcode === "string"
    ) {
      throw new BadGatewayException(
        typeof body.message === "string"
          ? `Moodle отклонил подключение: ${body.message}`
          : "Moodle отклонил подключение. Проверьте токен и права Web Services.",
      );
    }
    return body;
  }

  private decryptToken(config: MoodleConnectionConfig): string {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey(),
        Buffer.from(config.tokenIv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(config.tokenTag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(config.encryptedToken, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new BadRequestException(
        "Сохранённый токен Moodle нельзя расшифровать. Настройте подключение заново.",
      );
    }
  }

  private encryptionKey(): Buffer {
    const encoded = process.env.CONNECTOR_ENCRYPTION_KEY?.trim();
    if (!encoded) {
      throw new BadRequestException(
        "CONNECTOR_ENCRYPTION_KEY не настроен на сервере. Moodle нельзя подключить небезопасно.",
      );
    }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) {
      throw new BadRequestException(
        "CONNECTOR_ENCRYPTION_KEY должен быть base64-ключом длиной 32 байта.",
      );
    }
    return key;
  }
}

function requestPinnedMoodleEndpoint(
  endpoint: URL,
  addresses: LookupAddress[],
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const pinnedLookup = (
      _hostname: string,
      options: LookupOptions,
      callback: (
        error: NodeJS.ErrnoException | null,
        address: string | LookupAddress[],
        family?: number,
      ) => void,
    ) => {
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    };
    const request = httpsRequest(
      endpoint,
      { method: "GET", lookup: pinnedLookup, maxHeaderSize: 16 * 1024 },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.length;
          if (size > 1024 * 1024) {
            request.destroy(new Error("Moodle response exceeded the size limit"));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 502,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("Moodle response was aborted")));
      },
    );
    request.setTimeout(10_000, () => request.destroy(new Error("Moodle request timed out")));
    request.on("error", () => reject(new BadGatewayException("Moodle недоступен или не ответил за 10 секунд.")));
    request.end();
  });
}

export function normalizeMoodleBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException("Укажите корректный HTTPS-адрес Moodle.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new BadRequestException(
      "Moodle должен быть доступен по HTTPS без данных входа в URL.",
    );
  }
  if (url.hostname.toLowerCase() === "localhost" || isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new BadRequestException(
      "Используйте доменное имя Moodle, а не IP-адрес или localhost.",
    );
  }
  url.hash = "";
  url.search = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url.toString();
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
