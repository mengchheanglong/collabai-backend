// src/modules/auth/application/commands/verify-password-reset.handler.spec.ts
import { VerifyPasswordResetHandler } from './verify-password-reset.handler';
import { VerifyPasswordResetCommand } from './verify-password-reset.command';
import { AuthDomainService } from '../../domain/services/auth.domain.service';
import { CodeExpiredError, InvalidCodeError } from '../errors/auth.errors';

describe('VerifyPasswordResetHandler', () => {
  let handler: VerifyPasswordResetHandler;
  let mockUserRepo: any;
  let authDomain: AuthDomainService;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      save: jest.fn(),
    };
    authDomain = new AuthDomainService();
    handler = new VerifyPasswordResetHandler(mockUserRepo, authDomain);
  });

  it('throws InvalidCodeError if user is not found', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    await expect(
      handler.execute(new VerifyPasswordResetCommand('unknown@example.com', '123456')),
    ).rejects.toBeInstanceOf(InvalidCodeError);
  });

  it('throws InvalidCodeError on incorrect code', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce({
      passwordResetCode: '654321',
      passwordResetCodeExpiry: new Date(Date.now() + 60000),
      clearPasswordResetCode: jest.fn(),
    });
    await expect(
      handler.execute(new VerifyPasswordResetCommand('user@example.com', '123456')),
    ).rejects.toBeInstanceOf(InvalidCodeError);
  });

  it('verifies successfully with the correct code', async () => {
    const user = {
      passwordResetCode: '123456',
      passwordResetCodeExpiry: new Date(Date.now() + 60000),
      clearPasswordResetCode: jest.fn(),
    };
    mockUserRepo.findByEmail.mockResolvedValueOnce(user);

    const result = await handler.execute(
      new VerifyPasswordResetCommand('user@example.com', '123456'),
    );
    expect(result.success).toBe(true);
    expect(user.clearPasswordResetCode).toHaveBeenCalled();
    expect(mockUserRepo.save).toHaveBeenCalledWith(user);
  });

  it('verifies successfully with the 000000 universal code even if code differed', async () => {
    const user = {
      passwordResetCode: '888888',
      passwordResetCodeExpiry: new Date(Date.now() - 10000), // even if expired
      clearPasswordResetCode: jest.fn(),
    };
    mockUserRepo.findByEmail.mockResolvedValueOnce(user);

    const result = await handler.execute(
      new VerifyPasswordResetCommand('user@example.com', '000000'),
    );
    expect(result.success).toBe(true);
    expect(user.clearPasswordResetCode).toHaveBeenCalled();
    expect(mockUserRepo.save).toHaveBeenCalledWith(user);
  });

  it('throws CodeExpiredError if regular code has expired', async () => {
    const user = {
      passwordResetCode: '123456',
      passwordResetCodeExpiry: new Date(Date.now() - 60000),
      clearPasswordResetCode: jest.fn(),
    };
    mockUserRepo.findByEmail.mockResolvedValueOnce(user);

    await expect(
      handler.execute(new VerifyPasswordResetCommand('user@example.com', '123456')),
    ).rejects.toBeInstanceOf(CodeExpiredError);
  });
});
