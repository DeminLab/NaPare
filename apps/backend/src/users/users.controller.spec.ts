import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PersonalDataService } from './personal-data.service';
import { AccountErasureService } from './account-erasure.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: Partial<UsersService>;
  let erasure: { erase: jest.Mock };

  beforeEach(async () => {
    erasure = { erase: jest.fn().mockResolvedValue({ success: true, archiveModel: 'pseudonymous' }) };
    service = {
      findById: jest.fn().mockResolvedValue({ id: '1', email: 'test@test.com' }),
      update: jest.fn().mockResolvedValue({ id: '1', firstName: 'Updated' }),
      deactivate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }, { provide: PersonalDataService, useValue: {} }, { provide: AccountErasureService, useValue: erasure }],
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
    it('uses the confirmed erasure operation instead of administrative deactivation', async () => {
      const dto: DeleteAccountDto = { expectedUserId: '11111111-1111-4111-8111-111111111111', currentPassword: 'synthetic-password', confirmed: true, acknowledgeRetention: true };
      await expect(controller.deleteAccount(dto)).resolves.toEqual({ success: true, archiveModel: 'pseudonymous' });
      expect(erasure.erase).toHaveBeenCalledWith(dto);
      expect(service.deactivate).not.toHaveBeenCalled();
    });
  });

  it('returns the safe profile projection after mutation, without password hashes or session/link secrets', async () => {
    service.update = jest.fn().mockResolvedValue({ id: '1', firstName: 'Updated', passwordHash: 'synthetic-hash', sessionVersion: 8, telegramUserId: 'private-link', maxUserId: 'private-max' });
    const profile = await controller.updateProfile({ user: { id: '1' } }, { firstName: 'Updated' });
    expect(profile.firstName).toBe('Updated');
    for (const field of ['passwordHash', 'sessionVersion', 'telegramUserId', 'maxUserId']) expect(profile).not.toHaveProperty(field);
  });
});
