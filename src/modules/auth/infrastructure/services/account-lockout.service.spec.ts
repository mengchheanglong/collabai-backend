import { AccountLockoutService } from './account-lockout.service';
import { RedisService } from '../../../../shared/services/redis.service';

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;
  let redis: jest.Mocked<RedisService>;

  beforeEach(() => {
    redis = {
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      set: jest.fn(),
      exists: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    service = new AccountLockoutService(redis);
  });

  describe('recordFailedAttempt', () => {
    it('sets TTL on first failed attempt and does not block below threshold', async () => {
      redis.incr.mockResolvedValueOnce(1); // account attempts
      redis.incr.mockResolvedValueOnce(1); // IP attempts
      redis.expire.mockResolvedValue(undefined);

      await service.recordFailedAttempt('User@Example.COM', '127.0.0.1');

      expect(redis.incr).toHaveBeenCalledWith('lockout:account:attempts:user@example.com');
      expect(redis.incr).toHaveBeenCalledWith('lockout:ip:attempts:127.0.0.1');
      expect(redis.expire).toHaveBeenCalledWith('lockout:account:attempts:user@example.com', 900);
      expect(redis.expire).toHaveBeenCalledWith('lockout:ip:attempts:127.0.0.1', 900);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('blocks account when attempts reach 5', async () => {
      redis.incr.mockResolvedValueOnce(5); // account reached 5
      redis.ttl.mockResolvedValueOnce(800);
      redis.set.mockResolvedValue(undefined);

      redis.incr.mockResolvedValueOnce(5); // IP at 5 (< 20)
      redis.ttl.mockResolvedValueOnce(800);

      await service.recordFailedAttempt('target@example.com', '192.168.1.1');

      expect(redis.set).toHaveBeenCalledWith('lockout:account:blocked:target@example.com', '1', 1800);
      expect(redis.set).not.toHaveBeenCalledWith(expect.stringContaining('lockout:ip:blocked'), expect.anything(), expect.anything());
    });

    it('blocks IP when attempts reach 20', async () => {
      redis.incr.mockResolvedValueOnce(1); // account at 1
      redis.expire.mockResolvedValue(undefined);

      redis.incr.mockResolvedValueOnce(20); // IP reached 20
      redis.ttl.mockResolvedValueOnce(600);
      redis.set.mockResolvedValue(undefined);

      await service.recordFailedAttempt('innocent@example.com', '10.0.0.5');

      expect(redis.set).toHaveBeenCalledWith('lockout:ip:blocked:10.0.0.5', '1', 1800);
    });

    it('fails open when Redis throws during recordFailedAttempt without throwing', async () => {
      redis.incr.mockRejectedValue(new Error('Redis connection down'));

      await expect(
        service.recordFailedAttempt('test@example.com', '127.0.0.1'),
      ).resolves.not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('returns false when neither account nor IP is locked', async () => {
      redis.exists.mockResolvedValue(false);

      const locked = await service.isLocked('user@example.com', '127.0.0.1');
      expect(locked).toBe(false);
    });

    it('returns true when account is locked', async () => {
      redis.exists.mockImplementation(async (key: string) => {
        return key === 'lockout:account:blocked:user@example.com';
      });

      const locked = await service.isLocked('USER@Example.COM', '127.0.0.1');
      expect(locked).toBe(true);
    });

    it('returns true when IP is locked', async () => {
      redis.exists.mockImplementation(async (key: string) => {
        return key === 'lockout:ip:blocked:127.0.0.1';
      });

      const locked = await service.isLocked('other@example.com', '127.0.0.1');
      expect(locked).toBe(true);
    });

    it('fails open (returns false) when Redis exists throws', async () => {
      redis.exists.mockRejectedValue(new Error('Redis connection refused'));

      const locked = await service.isLocked('user@example.com', '127.0.0.1');
      expect(locked).toBe(false);
    });
  });

  describe('clearAttempts', () => {
    it('deletes attempts and blocked keys with normalized email', async () => {
      redis.del.mockResolvedValue(undefined);

      await service.clearAttempts('User@Example.COM');

      expect(redis.del).toHaveBeenCalledWith('lockout:account:attempts:user@example.com');
      expect(redis.del).toHaveBeenCalledWith('lockout:account:blocked:user@example.com');
    });

    it('fails open when Redis del throws without rethrowing', async () => {
      redis.del.mockRejectedValue(new Error('Redis timeout'));

      await expect(service.clearAttempts('user@example.com')).resolves.not.toThrow();
    });
  });
});
