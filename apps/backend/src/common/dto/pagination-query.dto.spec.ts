import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PaginationQueryDto, toPaginatedResponse } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  it('transforms query values and exposes a consistent response envelope', async () => {
    const query = plainToInstance(PaginationQueryDto, { page: '2', limit: '25' });

    expect(await validate(query)).toHaveLength(0);
    expect(toPaginatedResponse([{ id: 'one' }], 26, query)).toEqual({
      data: [{ id: 'one' }],
      meta: { page: 2, limit: 25, total: 26, totalPages: 2 },
    });
  });

  it('rejects an excessive page size', async () => {
    const query = plainToInstance(PaginationQueryDto, { limit: '101' });

    expect(await validate(query)).not.toHaveLength(0);
  });
});
