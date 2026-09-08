import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let redisClient: any;
  let jwtService: any;

  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';

  const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const mockPayload = { sub: 'user-1', jti: 'jti-uuid-1', exp: futureExp };

  beforeEach(async () => {
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      exists: jest.fn().mockResolvedValue(0),
    };

    jwtService = {
      decode: jest.fn().mockReturnValue(mockPayload),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        { provide: 'REDIS_CLIENT', useValue: redisClient },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('revokeAccessToken()', () => {
    it('should add jti to Redis with correct remaining TTL', async () => {
      await service.revokeAccessToken(mockToken);

      expect(redisClient.set).toHaveBeenCalledWith(
        `blacklist:token:${mockPayload.jti}`,
        mockPayload.sub,
        'EX',
        expect.any(Number),
      );

      // TTL should be close to 3600 (allow 2s tolerance)
      const ttlArg = redisClient.set.mock.calls[0][3];
      expect(ttlArg).toBeGreaterThan(3598);
      expect(ttlArg).toBeLessThanOrEqual(3600);
    });

    it('should not call Redis.set if token is already expired', async () => {
      jwtService.decode.mockReturnValue({
        ...mockPayload,
        exp: Math.floor(Date.now() / 1000) - 10, // already expired
      });

      await service.revokeAccessToken(mockToken);
      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it('should not throw if token has no jti', async () => {
      jwtService.decode.mockReturnValue({ sub: 'user-1', exp: futureExp }); // no jti
      await expect(service.revokeAccessToken(mockToken)).resolves.not.toThrow();
      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it('should not throw if Redis fails', async () => {
      redisClient.set.mockRejectedValue(new Error('Redis connection refused'));
      await expect(service.revokeAccessToken(mockToken)).resolves.not.toThrow();
    });
  });

  describe('isBlacklisted()', () => {
    it('should return false when jti is NOT in blacklist', async () => {
      redisClient.exists.mockResolvedValue(0);
      const result = await service.isBlacklisted('jti-uuid-1');
      expect(result).toBe(false);
      expect(redisClient.exists).toHaveBeenCalledWith('blacklist:token:jti-uuid-1');
    });

    it('should return true when jti IS in blacklist', async () => {
      redisClient.exists.mockResolvedValue(1);
      const result = await service.isBlacklisted('jti-uuid-1');
      expect(result).toBe(true);
    });

    it('should return false (fail-open) when Redis is unavailable', async () => {
      redisClient.exists.mockRejectedValue(new Error('Redis down'));
      const result = await service.isBlacklisted('jti-uuid-1');
      expect(result).toBe(false);
    });
  });
});
