import { ServiceUnavailableException } from "@nestjs/common";

import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("reports API and database health with uptime", async () => {
    const query = jest.fn().mockResolvedValue([{ "?column?": 1 }]);
    const controller = new HealthController({ query } as never);

    await expect(controller.check()).resolves.toMatchObject({
      status: "ok",
      database: "ok",
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 503 when the database cannot be reached", async () => {
    const controller = new HealthController({
      query: jest.fn().mockRejectedValue(new Error("offline")),
    } as never);

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
