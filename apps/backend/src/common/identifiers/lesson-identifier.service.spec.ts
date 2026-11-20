import { LessonIdentifierService } from "./lesson-identifier.service";

describe("LessonIdentifierService", () => {
  const groups = { findOne: jest.fn() };
  const lessons = { findOne: jest.fn() };
  let service: LessonIdentifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LessonIdentifierService(groups as never, lessons as never);
  });

  it("returns canonical UUIDs without repository queries", async () => {
    const id = "10000000-0000-4000-8000-000000000001";
    await expect(service.resolvePersistedLessonId(id, "uni-1")).resolves.toBe(id);
    expect(groups.findOne).not.toHaveBeenCalled();
    expect(lessons.findOne).not.toHaveBeenCalled();
  });

  it("resolves RASP links through group and lesson records in the same tenant", async () => {
    groups.findOne.mockResolvedValue({ id: "group-uuid" });
    lessons.findOne.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000002" });

    await expect(
      service.resolvePersistedLessonId("rasp-5725936-12131", "uni-1"),
    ).resolves.toBe("10000000-0000-4000-8000-000000000002");
    expect(groups.findOne).toHaveBeenCalledWith({
      where: { organizationId: "uni-1", externalId: "12131" },
    });
    expect(lessons.findOne).toHaveBeenCalledWith({
      where: { organizationId: "uni-1", groupId: "group-uuid", externalId: "5725936" },
      select: { id: true },
    });
  });

  it("does not query lessons when the external group is not mapped in the tenant", async () => {
    groups.findOne.mockResolvedValue(null);
    await expect(
      service.resolvePersistedLessonId("rasp-5725936-12131", "uni-1"),
    ).resolves.toBeNull();
    expect(lessons.findOne).not.toHaveBeenCalled();
  });

  it("rejects malformed IDs without repository queries", async () => {
    await expect(service.resolvePersistedLessonId("12131", "uni-1")).resolves.toBeNull();
    expect(groups.findOne).not.toHaveBeenCalled();
    expect(lessons.findOne).not.toHaveBeenCalled();
  });
});
