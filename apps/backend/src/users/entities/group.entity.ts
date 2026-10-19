import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

import { University } from "./university.entity";
import { Faculty } from "./faculty.entity";

@Entity("groups")
@Index("IDX_groups_university_name", ["universityId", "name"])
@Index("UQ_groups_university_external_id", ["universityId", "externalId"], {
  unique: true,
  where: '"externalId" IS NOT NULL',
})
@Index("IDX_groups_faculty_id", ["facultyId"])
export class Group {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  facultyId: string;

  @ManyToOne(() => Faculty, (faculty) => faculty.groups)
  @JoinColumn({ name: "facultyId" })
  faculty: Faculty;

  @Column({ type: "uuid" })
  universityId: string;

  @ManyToOne(() => University, (university) => university.groups)
  @JoinColumn({ name: "universityId" })
  university: University;

  @Column()
  name: string;

  /** Stable identifier from an external university source, for example SIBIT. */
  @Column({ type: "varchar", nullable: true })
  externalId: string | null;

  @Column({ type: "int" })
  curriculumYear: number;

  @Column({ nullable: true })
  specialization: string | null;

  @Column({ type: "uuid", nullable: true })
  curatorId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
