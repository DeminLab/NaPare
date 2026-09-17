import { Module } from '@nestjs/common';

import { RaspScraperService } from '../auth/rasp-scraper.service';

@Module({
  providers: [RaspScraperService],
  exports: [RaspScraperService],
})
export class RaspModule {}
