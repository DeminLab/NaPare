import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class MaxLinkDto {
  @ApiProperty({ description: "Строка window.WebApp.initData из MAX Bridge" })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData: string;
}
