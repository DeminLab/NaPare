import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { DataSource } from "typeorm";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({
    summary: "Проверка состояния API и подключения к базе данных",
  })
  async check() {
    const timestamp = new Date().toISOString();
    try {
      await this.dataSource.query("SELECT 1");
      return {
        status: "ok",
        database: "ok",
        timestamp,
        uptime: Math.floor(process.uptime()),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        database: "unavailable",
        timestamp,
      });
    }
  }
}
