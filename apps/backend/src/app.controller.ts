import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('app')
@Controller('app')
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API info' })
  info() {
    return {
      name: 'НаПаре API',
      version: '1.0',
      docs: '/api/v1/docs',
    };
  }
}
