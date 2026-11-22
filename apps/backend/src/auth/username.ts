import { BadRequestException } from '@nestjs/common';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new BadRequestException('Логин должен содержать 3–32 латинских буквы, цифры, точку, дефис или подчёркивание.');
  }
  return username;
}
