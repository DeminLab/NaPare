import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { TenantContext } from '../common/tenant/tenant-context';
import { UsersService } from "../users/users.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac } from "crypto";
import * as bcrypt from "bcrypt";

const MAX_BOT_TOKEN = "1234567890:TEST-BOT-TOKEN";

function buildMaxInitData(authDate: number, userId = 424242): string {
  const values: Record<string, string> = {
    auth_date: String(authDate),
    user: JSON.stringify({
      id: userId,
      first_name: "Иван",
      last_name: "Иванов",
    }),
  };
  const dataCheckString = Object.keys(values)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${values[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(MAX_BOT_TOKEN)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&")}&hash=${hash}`;
}

describe("AuthService", () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByMaxUserId: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      bindMaxUserIdIfUnlinked: jest.fn(),
      invalidateSessions: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue("mock-token"),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        TenantContext,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "max.botToken") return MAX_BOT_TOKEN;
              if (key === "max.initDataTtlSeconds") return 3600;
              return "15m";
            }),
            getOrThrow: jest.fn((key: string) =>
              key === "auth.jwt.refreshSecret" ? "test-refresh-secret" : "30d",
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("login", () => {
    it("should throw UnauthorizedException for non-existent user", async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      await expect(
        service.login({ email: "test@test.com", password: "pass" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("finds an account with an email entered in a different case", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "student@sibit.ru",
        passwordHash,
        isActive: true,
        firstName: "Тест",
        lastName: "Студент",
        role: "student",
        universityId: "uni-1",
        groupId: "12136",
      });

      await service.login({
        email: "Student@SIBIT.RU",
        password: "correct-password",
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith("Student@SIBIT.RU");
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });

  describe("portalLogin", () => {
    it.each([
      ["student", "student"],
      ["teacher", "staff"],
      ["university_admin", "admin"],
      ["developer", "developer"],
    ])("assigns %s to the %s workspace", async (role, workspace) => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "user@sibit.ru",
        passwordHash,
        isActive: true,
        firstName: "Тест",
        lastName: "Пользователь",
        role,
        universityId: "uni-1",
      });

      await expect(
        service.portalLogin({
          email: "user@sibit.ru",
          password: "correct-password",
        }),
      ).resolves.toMatchObject({ workspace });
    });

  });

  describe("refreshToken", () => {
    const refreshPayload = {
      sub: "user-1",
      email: "student@sibit.ru",
      role: "student",
      universityId: "uni-1",
      sessionVersion: 2,
    };

    it("rotates a refresh token only while its session version is current", async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(refreshPayload);
      (usersService.findById as jest.Mock).mockResolvedValue({
        ...refreshPayload,
        isActive: true,
        firstName: "Тест",
        lastName: "Студент",
      });

      await expect(
        service.refreshToken("refresh-token"),
      ).resolves.toMatchObject({
        accessToken: "mock-token",
      });
    });

    it("rejects refresh tokens from a revoked session version", async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(refreshPayload);
      (usersService.findById as jest.Mock).mockResolvedValue({
        ...refreshPayload,
        sessionVersion: 3,
        isActive: true,
      });

      await expect(
        service.refreshToken("revoked-refresh-token"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  it("invalidates the current user session on logout", async () => {
    await service.logout("user-1");

    expect(usersService.invalidateSessions).toHaveBeenCalledWith("user-1");
  });

  describe("maxAuth", () => {
    const freshInitData = () =>
      buildMaxInitData(Math.floor(Date.now() / 1000) - 60);
    const linkedUser = {
      id: "user-1",
      email: "student@sibit.ru",
      maxUserId: "424242",
      isActive: true,
      firstName: "Тест",
      lastName: "Студент",
      role: "student",
      universityId: "uni-1",
      groupId: "12136",
    };

    it("issues tokens for an account linked to the MAX user", async () => {
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue(linkedUser);

      await expect(
        service.maxAuth({ initData: freshInitData() }),
      ).resolves.toMatchObject({
        accessToken: "mock-token",
        user: { id: "user-1", email: "student@sibit.ru" },
      });
      expect(usersService.findByMaxUserId).toHaveBeenCalledWith("424242");
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it("links the account on the first login with credentials", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...linkedUser,
        maxUserId: null,
        passwordHash,
      });
      (usersService.bindMaxUserIdIfUnlinked as jest.Mock).mockResolvedValue(linkedUser);

      await expect(
        service.maxAuth({
          initData: freshInitData(),
          email: "student@sibit.ru",
          password: "correct-password",
        }),
      ).resolves.toMatchObject({ user: { id: "user-1" } });
      expect(usersService.bindMaxUserIdIfUnlinked).toHaveBeenCalledWith("user-1", "424242");
    });

    it("rejects an unlinked MAX account without credentials", async () => {
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue(null);

      await expect(
        service.maxAuth({ initData: freshInitData() }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "MAX_ACCOUNT_NOT_LINKED" }),
      });
    });

    it("rejects invalid credentials when linking", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...linkedUser,
        maxUserId: null,
        passwordHash,
      });

      await expect(
        service.maxAuth({
          initData: freshInitData(),
          email: "student@sibit.ru",
          password: "wrong-password",
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it("does not overwrite an account already linked to another MAX user", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 4);
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue(null);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...linkedUser,
        maxUserId: "another-max-user",
        passwordHash,
      });
      (usersService.bindMaxUserIdIfUnlinked as jest.Mock).mockRejectedValue(
        new ConflictException("Для этого аккаунта уже привязан другой MAX"),
      );

      await expect(service.maxAuth({
        initData: freshInitData(),
        email: "student@sibit.ru",
        password: "correct-password",
      })).rejects.toThrow(ConflictException);
      expect(usersService.bindMaxUserIdIfUnlinked).toHaveBeenCalledWith("user-1", "424242");
    });

    it("rejects initData that fails server-side validation", async () => {
      await expect(
        service.maxAuth({
          initData: `auth_date=${Math.floor(Date.now() / 1000)}&hash=${"0".repeat(64)}`,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "MAX_INVALID_INIT_DATA" }),
      });
      expect(usersService.findByMaxUserId).not.toHaveBeenCalled();
    });

    it("requires email and password together", async () => {
      await expect(
        service.maxAuth({
          initData: freshInitData(),
          email: "student@sibit.ru",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("reports 503 when MAX_BOT_TOKEN is not configured", async () => {
      const configService = {
        get: jest.fn().mockReturnValue(""),
        getOrThrow: jest.fn(),
      };
      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          TenantContext,
          { provide: UsersService, useValue: usersService },
          { provide: JwtService, useValue: jwtService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const unconfigured = module.get<AuthService>(AuthService);

      const error = await unconfigured
        .maxAuth({ initData: freshInitData() })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(
        (error as ServiceUnavailableException).getResponse(),
      ).toMatchObject({
        code: "MAX_NOT_CONFIGURED",
      });
      expect(usersService.findByMaxUserId).not.toHaveBeenCalled();
    });

    it("blocks deactivated accounts", async () => {
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue({
        ...linkedUser,
        isActive: false,
      });

      await expect(
        service.maxAuth({ initData: freshInitData() }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("linkMaxToAuthenticatedUser", () => {
    const freshInitData = () => buildMaxInitData(Math.floor(Date.now() / 1000) - 60);
    const activeUser = { id: "user-1", isActive: true, maxUserId: null, role: "student", universityId: "uni-1" };

    it("binds verified MAX identity to the current active session", async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(activeUser);
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue(null);
      (usersService.bindMaxUserIdIfUnlinked as jest.Mock).mockResolvedValue({ ...activeUser, maxUserId: "424242" });

      await expect(service.linkMaxToAuthenticatedUser(freshInitData(), "user-1"))
        .resolves.toMatchObject({ accessToken: "mock-token", user: { id: "user-1" } });
      expect(usersService.bindMaxUserIdIfUnlinked).toHaveBeenCalledWith("user-1", "424242");
    });

    it("rejects MAX identity already linked to a different account", async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(activeUser);
      (usersService.findByMaxUserId as jest.Mock).mockResolvedValue({ id: "user-2" });

      await expect(service.linkMaxToAuthenticatedUser(freshInitData(), "user-1"))
        .rejects.toThrow(ConflictException);
      expect(usersService.bindMaxUserIdIfUnlinked).not.toHaveBeenCalled();
    });
  });
});
