import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { REQUEST_ENTITIES } from './request.entities';
import { OfficeAccessService } from './office-access.service';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { OFFICE_REPORT_ENTITIES } from './office-report.entities';
import { OfficeReportService } from './office-report.service';
import { OfficeReportController } from './office-report.controller';

@Module({ imports: [TypeOrmModule.forFeature([...REQUEST_ENTITIES, ...OFFICE_REPORT_ENTITIES])], providers: [OfficeAccessService, OfficeReportService, RequestService], controllers: [OfficeReportController, RequestController] })
export class RequestModule {}
