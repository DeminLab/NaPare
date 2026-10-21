import { ServiceUnavailableException } from "@nestjs/common";

import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("reports API and database health with uptime", async () => {
    const query = jest.fn().mockResolvedValue([{ "?column?": 1 }]);
    const controller = new HealthController({ query } as never);

    await expect(controller.check()).resolves.toMatchObject({
      status: "ok",
      database: "ok",
      queue: "not_configured",
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("checks a configured queue and fails closed without exposing errors", async () => {
    const controller = new HealthController({ query: jest.fn().mockResolvedValue([]) } as never,
      { check: jest.fn().mockRejectedValue(new Error("redis://private-secret")) });
    await expect(controller.check()).rejects.toMatchObject({ response: {
      status: "error", database: "ok", queue: "unavailable", timestamp: expect.any(String),
    } });
  });

  it("reports a configured queue only after its probe succeeds", async () => {
    const check = jest.fn().mockResolvedValue(undefined);
    const controller = new HealthController({ query: jest.fn().mockResolvedValue([]) } as never, { check });
    await expect(controller.check()).resolves.toMatchObject({ database: "ok", queue: "ok" });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("bounds an unresponsive database probe", async () => {
    jest.useFakeTimers();
    try {
      const controller = new HealthController({ query: () => new Promise(() => {}) } as never);
      const result = expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
      await jest.advanceTimersByTimeAsync(3000);
      await result;
    } finally {
      jest.useRealTimers();
    }
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
