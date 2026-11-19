import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitTier } from '../../config/rate-limit.config';
import { ERROR_CODES } from '../constants/error-codes';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: jest.Mocked<Reflector>;
  let configService: jest.Mocked<ConfigService>;
  let mockRedisClient: { eval: jest.Mock };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    configService = {
      get: jest.fn().mockReturnValue({
        enabled: true,
        tiers: {
          [RateLimitTier.GLOBAL]: { ttl: 60, limit: 80, keyBy: 'ip' },
          [RateLimitTier.AI_GENERATE]: { ttl: 30, limit: 1, keyBy: 'user' },
          [RateLimitTier.AUTH_LOGIN]: { ttl: 60, limit: 5, keyBy: 'ip' },
        },
      }),
    } as unknown as jest.Mocked<ConfigService>;

    mockRedisClient = {
      eval: jest.fn(),
    };

    guard = new RateLimitGuard(reflector, configService, mockRedisClient as any);
  });

  function createMockContext(options?: {
    ip?: string;
    userId?: string;
    headers?: Record<string, string>;
  }): { context: ExecutionContext; setHeader: jest.Mock } {
    const setHeader = jest.fn();
    const req = {
      headers: options?.headers || {},
      ip: options?.ip || '127.0.0.1',
      socket: { remoteAddress: options?.ip || '127.0.0.1' },
      user: options?.userId ? { id: options.userId } : undefined,
    };
    const res = {
      setHeader,
    };

    const context = {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    return { context, setHeader };
  }

  it('nên cho qua nếu request không phải là HTTP context', async () => {
    const { context } = createMockContext();
    (context.getType as jest.Mock).mockReturnValue('rpc');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedisClient.eval).not.toHaveBeenCalled();
  });

  it('nên cho qua nếu hệ thống tắt Rate Limiting toàn cục', async () => {
    configService.get.mockReturnValueOnce({ enabled: false, tiers: {} });
    const { context } = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedisClient.eval).not.toHaveBeenCalled();
  });

  it('nên cho qua nếu route được gắn @SkipRateLimit()', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true); // RATE_LIMIT_SKIP_KEY
    const { context } = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRedisClient.eval).not.toHaveBeenCalled();
  });

  it('nên cho qua và gắn headers X-RateLimit-* khi số request còn trong hạn mức', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false) // skip
      .mockReturnValueOnce({ tier: RateLimitTier.AUTH_LOGIN }); // options
    mockRedisClient.eval.mockResolvedValueOnce([2, 55]); // current=2, ttl=55s

    const { context, setHeader } = createMockContext({ ip: '14.162.1.1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ratelimit:AUTH_LOGIN:ip:14.162.1.1',
      '60',
    );
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '3');
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('nên ném lỗi HttpException 429 khi số request vượt quá hạn mức', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false) // skip
      .mockReturnValueOnce({ tier: RateLimitTier.AI_GENERATE }); // options (limit 1, ttl 30)
    mockRedisClient.eval.mockResolvedValueOnce([2, 28]); // current=2 > limit 1

    const { context, setHeader } = createMockContext({ userId: 'usr-999' });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(context);
    } catch (err) {
      const e = err as HttpException;
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const res = e.getResponse() as any;
      expect(res.errorCode).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
      expect(res.retryAfter).toBe(28);
    }

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '28');
  });

  it('nên fail-open (trả về true) nếu Redis gặp lỗi để bảo vệ trải nghiệm người dùng', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false) // skip
      .mockReturnValueOnce({ tier: RateLimitTier.GLOBAL });
    mockRedisClient.eval.mockRejectedValueOnce(new Error('Redis connection refused'));

    const { context } = createMockContext({ ip: '10.0.0.1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('nên trích xuất đúng IP từ header x-forwarded-for khi chạy sau Reverse Proxy', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce({ tier: RateLimitTier.GLOBAL });
    mockRedisClient.eval.mockResolvedValueOnce([1, 60]);

    const { context } = createMockContext({
      headers: { 'x-forwarded-for': '203.113.1.5, 192.168.1.1' },
    });

    await guard.canActivate(context);

    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ratelimit:GLOBAL:ip:203.113.1.5',
      '60',
    );
  });
});
