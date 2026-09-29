import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { FAVORITE_KINDS, FavoriteKind } from '../entities/favorite.entity';

export class FavoriteDto {
  @IsIn(FAVORITE_KINDS)
  kind: FavoriteKind;

  @IsString()
  @MinLength(1)
  @MaxLength(220)
  externalId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(220)
  label: string;
}

export class RemoveFavoriteDto {
  @IsIn(FAVORITE_KINDS)
  kind: FavoriteKind;

  @IsString()
  @MinLength(1)
  @MaxLength(220)
  externalId: string;
}
