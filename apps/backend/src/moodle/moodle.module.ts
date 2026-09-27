import { Module } from "@nestjs/common";

import { MoodleConnectorService } from "./moodle-connector.service";

@Module({
  providers: [MoodleConnectorService],
  exports: [MoodleConnectorService],
})
export class MoodleModule {}
