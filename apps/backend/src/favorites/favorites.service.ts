import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite, FavoriteKind } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(@InjectRepository(Favorite) private readonly favorites: Repository<Favorite>) {}

  list(userId: string, universityId: string): Promise<Favorite[]> {
    return this.favorites.find({ where: { userId, universityId }, order: { kind: 'ASC', label: 'ASC' } });
  }

  async add(userId: string, universityId: string, kind: FavoriteKind, externalIdInput: string, labelInput: string): Promise<void> {
    const externalId = this.normalize(kind, externalIdInput);
    const label = labelInput.trim().normalize('NFKC');
    if (!label) throw new BadRequestException('Укажите название избранного элемента');
    await this.favorites.upsert({ userId, universityId, kind, externalId, label }, ['userId', 'universityId', 'kind', 'externalId']);
  }

  async remove(userId: string, universityId: string, kind: FavoriteKind, externalIdInput: string): Promise<void> {
    const externalId = this.normalize(kind, externalIdInput);
    await this.favorites.delete({ userId, universityId, kind, externalId });
  }

  private normalize(kind: FavoriteKind, value: string): string {
    const trimmed = value.trim().normalize('NFKC');
    const normalized = kind === 'teacher' ? trimmed.toLocaleLowerCase('ru-RU') : trimmed;
    if (!normalized || normalized.length > 220 || (kind === 'group' && !/^\d+$/.test(normalized))) {
      throw new BadRequestException('Идентификатор избранного элемента недопустим');
    }
    return normalized;
  }
}
