import {
  Controller,
  Get,
  Inject,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { DataSource } from "typeorm";

export const HEALTH_QUEUE_PROBE = Symbol("HEALTH_QUEUE_PROBE");

export interface HealthQueueProbe {
  check(): Promise<void>;
}

async function withDeadline(check: () => Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Health check timeout")), 3000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(HEALTH_QUEUE_PROBE)
    private readonly queue?: HealthQueueProbe,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Проверка состояния API и подключения к базе данных",
  })
  async check() {
    const timestamp = new Date().toISOString();
    const queueProbe = this.queue;
    const [database, queue] = await Promise.allSettled([
      withDeadline(() => this.dataSource.query("SELECT 1")),
      queueProbe ? withDeadline(() => queueProbe.check()) : Promise.resolve(),
    ]);
    const dependencies = {
      database: database.status === "fulfilled" ? "ok" : "unavailable",
      queue: !this.queue
        ? "not_configured"
        : queue.status === "fulfilled" ? "ok" : "unavailable",
    };
    if (database.status === "fulfilled" && queue.status === "fulfilled") {
      return {
        status: "ok",
        ...dependencies,
        timestamp,
        uptime: Math.floor(process.uptime()),
      };
    }
    throw new ServiceUnavailableException({
      status: "error",
      ...dependencies,
      timestamp,
    });
  }
}
