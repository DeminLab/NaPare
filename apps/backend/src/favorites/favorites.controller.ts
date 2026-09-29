import { Body, Controller, Delete, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';
import { FavoriteDto, RemoveFavoriteDto } from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('users/me/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить избранные группы и преподавателей текущего студента' })
  list(@Request() req) {
    return this.favorites.list(req.user.id, req.user.universityId);
  }

  @Post()
  @ApiOperation({ summary: 'Добавить или обновить избранную группу/преподавателя' })
  async add(@Request() req, @Body() dto: FavoriteDto) {
    await this.favorites.add(req.user.id, req.user.universityId, dto.kind, dto.externalId, dto.label);
    return { success: true };
  }

  @Delete()
  @ApiOperation({ summary: 'Убрать группу/преподавателя из избранного' })
  async remove(@Request() req, @Body() dto: RemoveFavoriteDto) {
    await this.favorites.remove(req.user.id, req.user.universityId, dto.kind, dto.externalId);
    return { success: true };
  }
}
