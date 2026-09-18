import { SibitUniversityBootstrapService } from './sibit-university-bootstrap.service';

describe('SibitUniversityBootstrapService', () => {
  it('creates an active SIBIT tenant when the database has none', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SibitUniversityBootstrapService(repository as any);

    await service.onApplicationBootstrap();

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'СИБИТ', city: 'Омск', status: 'active', connectorType: 'rasp-sano',
    }));
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('activates an existing SIBIT tenant without creating a duplicate', async () => {
    const university = { id: 'uni-1', name: 'СИБИТ', city: 'Омск', status: 'pending', connectorType: null };
    const repository = {
      findOne: jest.fn().mockResolvedValue(university),
      create: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SibitUniversityBootstrapService(repository as any);

    await service.onApplicationBootstrap();

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active', connectorType: 'rasp-sano',
    }));
  });
});
