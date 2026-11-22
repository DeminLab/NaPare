import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ResetUniversityUserPasswordDto {
  @ApiProperty({ example: "temporary-password-2026", minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
