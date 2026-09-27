import { IsString, IsUrl, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ConfigureMoodleConnectorDto {
  @ApiProperty({ example: "https://moodle.university.ru/" })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  baseUrl: string;

  @ApiProperty({
    description:
      "Moodle Web Services token; it is encrypted and never returned.",
  })
  @IsString()
  @MinLength(16)
  token: string;
}
