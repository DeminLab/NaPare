import { ForbiddenException } from "@nestjs/common";

import { AuthController } from "./auth.controller";

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

  it("revokes the authenticated session on logout", async () => {
    const authService = { logout: jest.fn() };
    const controller = new AuthController(
      authService as never,
      {} as never,
      {} as never,
    );

    await expect(
      controller.logout({ user: { id: "user-1" } }),
    ).resolves.toEqual({ success: true });
    expect(authService.logout).toHaveBeenCalledWith("user-1");
  });
});
