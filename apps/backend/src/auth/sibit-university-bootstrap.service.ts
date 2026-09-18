import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { University } from '../users/entities/university.entity';
import { SIBIT_UNIVERSITY } from './rasp-scraper.service';

/** Ensures the pilot university exists before public registration is served. */
@Injectable()
export class SibitUniversityBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SibitUniversityBootstrapService.name);

  constructor(
    @InjectRepository(University)
    private readonly universitiesRepository: Repository<University>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const university = await this.universitiesRepository.findOne({
      where: { name: SIBIT_UNIVERSITY.name, city: SIBIT_UNIVERSITY.city },
    });

    if (!university) {
      await this.universitiesRepository.save(this.universitiesRepository.create({
        name: SIBIT_UNIVERSITY.name,
        city: SIBIT_UNIVERSITY.city,
        status: 'active',
        connectorType: 'rasp-sano',
      }));
      this.logger.log('Created active pilot university: СИБИТ, Омск');
      return;
    }

    if (university.status !== 'active') {
      university.status = 'active';
      if (!university.connectorType) university.connectorType = 'rasp-sano';
      await this.universitiesRepository.save(university);
      this.logger.log('Activated pilot university: СИБИТ, Омск');
    }
  }
}
