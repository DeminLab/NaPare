import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let service: Partial<UsersService>;

  beforeEach(async () => {
    service = {
      findById: jest.fn().mockResolvedValue({ id: '1', email: 'test@test.com' }),
      update: jest.fn().mockResolvedValue({ id: '1', firstName: 'Updated' }),
      deactivate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const result = await controller.getProfile({ user: { id: '1' } });
      expect(result).toEqual({ id: '1', email: 'test@test.com' });
    });
  });

  describe('deleteAccount', () => {
    it('should deactivate user', async () => {
      await controller.deleteAccount({ user: { id: '1' } });
      expect(service.deactivate).toHaveBeenCalledWith('1');
    });
  });
});
