import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { RolesGuard } from "../common/guards/roles.guard";
import { UserRole } from "../auth/interfaces/user-role";
import { PairSpaceController } from "./pair-space.controller";

describe("PairSpaceController content write authorization", () => {
  const rolesGuard = new RolesGuard(new Reflector());
  const controller = new PairSpaceController({} as any);

  const contextFor = (handler: Function, role: UserRole) =>
    ({
      getHandler: () => handler,
      getClass: () => PairSpaceController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: "user-1", role, universityId: "university-1" },
        }),
      }),
    }) as any;

  it.each(["createAnnouncement", "createHomework", "uploadFile"] as const)(
    "rejects students from %s",
    (method) => {
      expect(() =>
        rolesGuard.canActivate(
          contextFor(controller[method], UserRole.STUDENT),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it("allows a teacher to create an announcement", () => {
    expect(
      rolesGuard.canActivate(
        contextFor(controller.createAnnouncement, UserRole.TEACHER),
      ),
    ).toBe(true);
  });

  it("gets or creates the lesson space in the authenticated university", async () => {
    const pairSpaceService = {
      getOrCreateByLesson: jest.fn().mockResolvedValue({ id: "space-1" }),
    };
    const subject = new PairSpaceController(pairSpaceService as any);

    await expect(
      subject.findByLesson("lesson-1", {
        user: { universityId: "university-1" },
      }),
    ).resolves.toEqual({ id: "space-1" });
    expect(pairSpaceService.getOrCreateByLesson).toHaveBeenCalledWith(
      "lesson-1",
      "university-1",
    );
  });
});
