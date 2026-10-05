// src/modules/auth/application/commands/verify-email.handler.spec.ts
import { VerifyEmailHandler } from './verify-email.handler';
import { VerifyEmailCommand } from './verify-email.command';
import { AuthDomainService } from '../../domain/services/auth.domain.service';
import {
  CodeExpiredError,
  EmailAlreadyVerifiedError,
  InvalidCodeError,
} from '../errors/auth.errors';

describe('VerifyEmailHandler', () => {
  let handler: VerifyEmailHandler;
  let mockUserRepo: any;
  let authDomain: AuthDomainService;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      save: jest.fn(),
    };
    authDomain = new AuthDomainService();
    eventEmitter = { emit: jest.fn() };
    handler = new VerifyEmailHandler(mockUserRepo, authDomain, eventEmitter as any);
  });

  it('throws InvalidCodeError if user is not found', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce(null);
    await expect(
      handler.execute(new VerifyEmailCommand('unknown@example.com', '123456')),
    ).rejects.toBeInstanceOf(InvalidCodeError);
  });

  it('throws EmailAlreadyVerifiedError if user is already verified', async () => {
    mockUserRepo.findByEmail.mockResolvedValueOnce({
      isVerified: true,
    });
    await expect(
      handler.execute(new VerifyEmailCommand('user@example.com', '123456')),
    ).rejects.toBeInstanceOf(EmailAlreadyVerifiedError);
  });

  it('verifies successfully with the correct code', async () => {
    const user = {
      isVerified: false,
      verificationCode: '123456',
      verificationCodeExpiry: new Date(Date.now() + 60000),
      markVerified: jest.fn(),
    };
    mockUserRepo.findByEmail.mockResolvedValueOnce(user);

    const result = await handler.execute(
      new VerifyEmailCommand('user@example.com', '123456'),
    );
    expect(result.success).toBe(true);
    expect(user.markVerified).toHaveBeenCalled();
    expect(mockUserRepo.save).toHaveBeenCalledWith(user);
  });

  it('announces the verified email so pending invitations can be accepted', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      isVerified: false,
      verificationCode: '123456',
      verificationCodeExpiry: new Date(Date.now() + 60000),
      markVerified: jest.fn(),
    };
    mockUserRepo.findByEmail.mockResolvedValueOnce(user);

    await handler.execute(new VerifyEmailCommand('user@example.com', '123456'));

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.email.verified',
      expect.objectContaining({ userId: 'user-1', email: 'user@example.com' }),
    );
  });

  it('rejects 000000 — there is no universal bypass code', async () => {
    const user = {
      isVerified: false,
      verificationCode: '999999',
      verificationCodeExpiry: new Date(Date.now() + 60000),
      markVerified: jest.fn(),
    };
    mockUserRepo.findByEmail.mockResolvedValueOnce(user);

    await expect(
      handler.execute(new VerifyEmailCommand('user@example.com', ' 000000 ')),
    ).rejects.toThrow(InvalidCodeError);
    expect(user.markVerified).not.toHaveBeenCalled();
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it('throws CodeExpiredError if regular code has expired', async () => {
    const user = {
      isVerified: false,
      verificationCode: '123456',
      verificationCodeExpiry: new Date(Date.now() - 60000),
      markVerified: jest.fn(),
    };
    mockUserRepo.findByEmail.mockResolvedValueOnce(user);

    await expect(
      handler.execute(new VerifyEmailCommand('user@example.com', '123456')),
    ).rejects.toBeInstanceOf(CodeExpiredError);
  });
});
