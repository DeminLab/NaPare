import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

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
    const endpoint = new URL("webservice/rest/server.php", config.baseUrl);
    endpoint.searchParams.set("wstoken", this.decryptToken(config));
    endpoint.searchParams.set("wsfunction", "core_webservice_get_site_info");
    endpoint.searchParams.set("moodlewsrestformat", "json");

    let response: Response;
    try {
      response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new BadGatewayException(
        "Moodle недоступен или не ответил за 10 секунд.",
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(`Moodle вернул HTTP ${response.status}.`);
    }

    const body = (await response.json()) as Record<string, unknown>;
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
    return {
      siteName: stringOrNull(body.sitename),
      userName: stringOrNull(body.username),
      release: stringOrNull(body.release),
    };
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
  if (
    url.hostname === "localhost" ||
    /^127\./.test(url.hostname) ||
    url.hostname === "::1"
  ) {
    throw new BadRequestException(
      "Локальный адрес нельзя использовать как Moodle-коннектор.",
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
