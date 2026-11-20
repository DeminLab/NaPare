import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Group } from "../../users/entities/group.entity";
import { Lesson } from "../../schedule/entities/lesson.entity";
import { isPersistedLessonId, parseRaspLessonId } from "./lesson-id";

/** Resolves legacy source links only through mappings owned by the active tenant. */
@Injectable()
export class LessonIdentifierService {
  constructor(
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
  ) {}

  async resolvePersistedLessonId(
    value: string,
    organizationId: string,
  ): Promise<string | null> {
    if (isPersistedLessonId(value)) return value;
    const external = parseRaspLessonId(value);
    if (!external) return null;

    const group = await this.groups.findOne({
      where: { organizationId, externalId: external.groupExternalId },
    });
    if (!group) return null;

    const lesson = await this.lessons.findOne({
      where: {
        organizationId,
        groupId: group.id,
        externalId: external.sourceLessonId,
      },
      select: { id: true },
    });
    return lesson?.id ?? null;
  }
}
