import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  canLinkAbsenceToLesson,
  clearTokens,
  createAbsence,
  getAccessToken,
  getMyDay,
  getRefreshToken,
  isAuthenticated,
  loginWithMax,
  saveTokens,
} from "./api";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("MAX mini app API client", () => {
  beforeEach(() => {
    clearTokens();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and clears tokens", () => {
    saveTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
    expect(isAuthenticated()).toBe(true);

    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("sends the access token and parses collection payloads", async () => {
    saveTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, {
          data: [],
          meta: { page: 1, limit: 25, total: 0, totalPages: 0 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyDay();

    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 25, total: 0, totalPages: 0 },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/my-day");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer access-1",
    );
  });

  it("refreshes the access token once after a 401", async () => {
    saveTokens({ accessToken: "stale", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { code: "UNAUTHORIZED", message: "Unauthorized" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "fresh", refreshToken: "refresh-2" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { date: "2026-09-24", lessons: [] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyDay();

    expect(result).toMatchObject({ date: "2026-09-24" });
    expect(getAccessToken()).toBe("fresh");
    expect(getRefreshToken()).toBe("refresh-2");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(refreshUrl).toContain("/auth/refresh");
    expect(String(refreshInit.body)).toContain("refresh-1");
  });

  it("drops stored tokens when the refresh is rejected", async () => {
    saveTokens({ accessToken: "stale", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { code: "UNAUTHORIZED", message: "Unauthorized" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          code: "UNAUTHORIZED",
          message: "Invalid refresh token",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const error = await getMyDay().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("UNAUTHORIZED");
    expect((error as ApiError).status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("surfaces backend error codes such as MAX_ACCOUNT_NOT_LINKED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          code: "MAX_ACCOUNT_NOT_LINKED",
          message:
            "Аккаунт MAX не привязан. Войдите по email и паролю, чтобы привязать его.",
        }),
      ),
    );

    const error = await loginWithMax("signed-data").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("MAX_ACCOUNT_NOT_LINKED");
    expect((error as ApiError).message).toContain("не привязан");
  });

  it("stores tokens after a successful MAX login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        accessToken: "access-new",
        refreshToken: "refresh-new",
        user: {
          id: "u1",
          email: "student@sibit.ru",
          firstName: "Тест",
          lastName: "Студент",
          role: "student",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loginWithMax("signed-data");

    expect(result.user.id).toBe("u1");
    expect(getAccessToken()).toBe("access-new");
    expect(getRefreshToken()).toBe("refresh-new");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/auth/max");
    expect(String(init.body)).toContain("signed-data");
  });

  it("sends the selected lesson with a student absence", async () => {
    saveTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { id: "absence-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await createAbsence({
      type: "learning",
      startDate: "2026-09-26",
      endDate: "2026-09-26",
      lessonId: "lesson-1",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/absences");
    expect(String(init.body)).toContain('"lessonId":"lesson-1"');
  });

  it("does not attach a temporary external schedule row to an absence", () => {
    expect(
      canLinkAbsenceToLesson({ id: "rasp-5632268-81", source: "rasp.sano.ru" }),
    ).toBe(false);
    expect(canLinkAbsenceToLesson({ id: "lesson-1" })).toBe(true);
  });

  it("reports network failures as ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    const error = await getMyDay().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("NETWORK_ERROR");
    expect((error as ApiError).status).toBe(0);
  });
});
