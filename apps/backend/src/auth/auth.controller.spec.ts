import { ForbiddenException } from "@nestjs/common";

import { AuthController } from "./auth.controller";

function request(user: { id: string; sessionId?: string }, headers: Record<string, string> = {}) {
  return { user, ip: "203.0.113.10", get: (name: string) => headers[name.toLowerCase()] };
}

describe("AuthController", () => {
  it("limits password and MAX authentication endpoints to 10 requests per minute", () => {
    for (const method of ["login", "portalLogin", "maxAuth", "linkMaxToCurrentUser"] as const) {
      expect(Reflect.getMetadata("THROTTLER:LIMITdefault", AuthController.prototype[method])).toBe(10);
      expect(Reflect.getMetadata("THROTTLER:TTLdefault", AuthController.prototype[method])).toBe(60_000);
    }
  });

  it("rejects public registration", () => {
    const controller = new AuthController(
      {} as never,
      {} as never,
      {} as never,
    );

    expect(() => controller.register()).toThrow(ForbiddenException);
  });

  it("revokes the authenticated session on logout with request context", async () => {
    const authService = { logout: jest.fn() };
    const controller = new AuthController(
      authService as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.logout(request({ id: "user-1" }, { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "x-napare-client": "web" })),
    ).resolves.toEqual({ success: true });
    expect(authService.logout).toHaveBeenCalledWith("user-1", {
      ip: "203.0.113.10",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      client: "web",
    });
  });

  it("passes the revoke comment to the session endpoint", async () => {
    const authService = { revokeOwnSession: jest.fn().mockResolvedValue(true) };
    const controller = new AuthController(authService as never, {} as never, {} as never);

    await expect(
      controller.revokeSession("session-1", { reason: "Выход с устройства" }, request({ id: "user-1", sessionId: "session-1" })),
    ).resolves.toEqual({ changed: true, current: true });
    expect(authService.revokeOwnSession).toHaveBeenCalledWith("user-1", "session-1", expect.objectContaining({ ip: "203.0.113.10" }), "Выход с устройства");
  });

  it("lists server-side sessions of the current account", async () => {
    const authService = { sessions: jest.fn().mockResolvedValue([{ id: "session-1" }]) };
    const controller = new AuthController(authService as never, {} as never, {} as never);

    await expect(controller.sessions(request({ id: "user-1", sessionId: "session-1" }))).resolves.toEqual({
      data: [{ id: "session-1" }],
      currentSessionId: "session-1",
    });
    expect(authService.sessions).toHaveBeenCalledWith("user-1");
  });
});
