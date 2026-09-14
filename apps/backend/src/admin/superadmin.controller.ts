import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SuperadminService } from './superadmin.service';
import { CreateUniversityDto } from './dto/create-university.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { UserRole } from '../auth/interfaces/user-role';
import { PaginatedResponseDto, PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('superadmin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('superadmin')
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('universities')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Получить список университетов' })
  @ApiOkResponse({ description: 'Университеты получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUniversities(@Query() pagination: PaginationQueryDto) {
    return this.superadminService.getUniversities(pagination);
  }

  @Post('universities')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Создать университет' })
  @ApiResponse({ status: 201, description: 'Университет создан' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createUniversity(@Body() createUniversityDto: CreateUniversityDto) {
    return this.superadminService.createUniversity(createUniversityDto);
  }

  @Patch('universities/:id')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Обновить университет' })
  @ApiResponse({ status: 200, description: 'Университет обновлён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateUniversity(
    @Param('id') id: string,
    @Body() updateUniversityDto: UpdateUniversityDto,
  ) {
    return this.superadminService.updateUniversity(id, updateUniversityDto);
  }

  @Delete('universities/:id')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Удалить университет' })
  @ApiResponse({ status: 200, description: 'Университет удалён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteUniversity(@Param('id') id: string) {
    return this.superadminService.deleteUniversity(id);
  }

  @Get('connectors')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Получить список коннекторов' })
  @ApiOkResponse({ description: 'Коннекторы получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConnectors(@Query() pagination: PaginationQueryDto) {
    return this.superadminService.getConnectors(pagination);
  }

  @Patch('connectors/:id')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Обновить коннектор' })
  @ApiResponse({ status: 200, description: 'Коннектор обновлён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateConnector(
    @Param('id') id: string,
    @Body() updateConnectorDto: UpdateConnectorDto,
  ) {
    return this.superadminService.updateConnector(id, updateConnectorDto);
  }
}
