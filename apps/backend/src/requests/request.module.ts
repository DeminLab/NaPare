import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { REQUEST_ENTITIES } from './request.entities';
import { OfficeAccessService } from './office-access.service';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';

@Module({ imports: [TypeOrmModule.forFeature(REQUEST_ENTITIES)], providers: [OfficeAccessService, RequestService], controllers: [RequestController] })
export class RequestModule {}
