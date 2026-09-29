// src/modules/auth/application/commands/refresh-token.handler.spec.ts
//
// Unit tests and integration tests for RefreshTokenHandler:
//   1. Unit tests: mocked repositories & token service (runs in CI without a live database).
//   2. Integration tests: runs against live DATABASE_URL if available, skips gracefully in CI.

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenHandler } from './refresh-token.handler';
import { RefreshTokenCommand } from './refresh-token.command';
import { UserRepository } from '../../infrastructure/persistence/user.repository';
import { RefreshTokenRepository } from '../../infrastructure/persistence/refresh-token.repository';
import { AuthTokenService } from '../../infrastructure/services/auth-token.service';
import { RefreshTokenEntity } from '../../domain/entities/refresh-token.entity';
import {
  InvalidRefreshTokenError,
  RefreshTokenReuseDetectedError,
} from '../errors/auth.errors';

jest.setTimeout(30000);

describe('RefreshTokenHandler (unit)', () => {
  let handler: RefreshTokenHandler;
  let mockUserRepo: any;
  let mockRefreshRepo: any;
  let mockTokenService: any;

  const userId = '11111111-1111-1111-1111-111111111111';
  const mockUser = {
    id: userId,
    email: 'user@example.com',
    role: 'member',
  };

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn().mockResolvedValue(mockUser),
    };
    mockRefreshRepo = {
      rotate: jest.fn().mockResolvedValue('rotated'),
      deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    mockTokenService = {
      verifyRefreshToken: jest.fn().mockReturnValue({ sub: userId, jti: 'jti-1' }),
      signAccessToken: jest.fn().mockReturnValue({ accessToken: 'new-access-token' }),
      signRefreshToken: jest.fn().mockReturnValue({
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
      }),
    };

    handler = new RefreshTokenHandler(mockUserRepo, mockRefreshRepo, mockTokenService);
  });

  it('rotates a valid refresh token and returns new tokens', async () => {
    const result = await handler.execute(new RefreshTokenCommand('valid-refresh-token'));

    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(mockTokenService.verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    expect(mockUserRepo.findById).toHaveBeenCalledWith(userId);
    expect(mockRefreshRepo.rotate).toHaveBeenCalledTimes(1);
  });

  it('detects replay/theft, revokes all user sessions, and throws RefreshTokenReuseDetectedError', async () => {
    mockRefreshRepo.rotate.mockResolvedValueOnce('reuse');

    await expect(
      handler.execute(new RefreshTokenCommand('replayed-spent-token')),
    ).rejects.toThrow(RefreshTokenReuseDetectedError);

    expect(mockRefreshRepo.deleteAllForUser).toHaveBeenCalledWith(userId);
  });

  it('throws InvalidRefreshTokenError when token is not found or expired', async () => {
    mockRefreshRepo.rotate.mockResolvedValueOnce('not_found');

    await expect(
      handler.execute(new RefreshTokenCommand('not-found-token')),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when JWT signature verification fails', async () => {
    mockTokenService.verifyRefreshToken.mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });

    await expect(
      handler.execute(new RefreshTokenCommand('malformed-token')),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when user is not found in database', async () => {
    mockUserRepo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new RefreshTokenCommand('valid-token-dead-user')),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });
});

// Integration tests: conditionally executed only when DATABASE_URL is set and reachable
describe('RefreshTokenHandler — rotation theft detection (integration)', () => {
  let prisma: PrismaClient | null = null;
  let tokenService: AuthTokenService;
  let userRepo: UserRepository;
  let refreshRepo: RefreshTokenRepository;
  let handler: RefreshTokenHandler;
  let dbAvailable = false;

  const noopRedis = {
    get: async () => null,
    set: async () => undefined,
    del: async () => undefined,
    deleteByPrefix: async () => undefined,
  } as any;

  const config = {
    get: (k: string) =>
      k === 'JWT_SECRET' || k === 'JWT_REFRESH_SECRET'
        ? 'test-secret'
        : undefined,
  } as any;

  const userId = randomUUID();
  const email = `theft_${Date.now()}@example.com`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }

    try {
      prisma = new PrismaClient();
      tokenService = new AuthTokenService(new JwtService({}), config);
      userRepo = new UserRepository(prisma as any, noopRedis);
      refreshRepo = new RefreshTokenRepository(prisma as any, noopRedis);
      handler = new RefreshTokenHandler(userRepo, refreshRepo, tokenService);

      await prisma.$connect();
      await prisma.user.create({
        data: {
          id: userId,
          email,
          name: 'Theft Test',
          passwordHash: 'hash',
          emailVerified: true,
        },
      });
      dbAvailable = true;
    } catch {
      dbAvailable = false;
      if (prisma) {
        await prisma.$disconnect().catch(() => undefined);
      }
    }
  });

  afterAll(async () => {
    if (prisma && dbAvailable) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it("rotates once, detects replay as reuse, and wipes all of the user's tokens", async () => {
    if (!dbAvailable) {
      // Skipped in environments without a reachable database (e.g. GitHub Actions CI)
      return;
    }

    const first = tokenService.signRefreshToken(userId);
    await refreshRepo.save(
      RefreshTokenEntity.create({
        id: randomUUID(),
        userId,
        rawToken: first.refreshToken,
        expiresAt: first.expiresAt,
      }),
    );

    const rotated = await handler.execute(
      new RefreshTokenCommand(first.refreshToken),
    );
    expect(typeof rotated.accessToken).toBe('string');
    expect(typeof rotated.refreshToken).toBe('string');
    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    expect(await prisma!.refreshToken.count({ where: { userId } })).toBe(2);

    await expect(
      handler.execute(new RefreshTokenCommand(first.refreshToken)),
    ).rejects.toBeInstanceOf(RefreshTokenReuseDetectedError);

    expect(await prisma!.refreshToken.count({ where: { userId } })).toBe(0);
  });

  it('treats a validly-signed but unknown token as InvalidRefreshTokenError (not reuse)', async () => {
    if (!dbAvailable) {
      // Skipped in environments without a reachable database (e.g. GitHub Actions CI)
      return;
    }

    const unknown = tokenService.signRefreshToken(userId);
    await expect(
      handler.execute(new RefreshTokenCommand(unknown.refreshToken)),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(await prisma!.refreshToken.count({ where: { userId } })).toBe(0);
  });
});
