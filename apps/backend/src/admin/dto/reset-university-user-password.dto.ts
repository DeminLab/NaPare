import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ResetUniversityUserPasswordDto {
  @ApiProperty({ example: "temporary-password-2026" })
  @IsString()
  @MinLength(10)
  password: string;
}
