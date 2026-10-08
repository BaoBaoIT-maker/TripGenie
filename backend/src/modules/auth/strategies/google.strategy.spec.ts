import { GoogleStrategy } from './google.strategy';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => defaultValue),
    };
    strategy = new GoogleStrategy(mockConfigService as ConfigService);
  });

  it('từ chối tài khoản Google nếu email chưa được xác minh', async () => {
    const mockProfile = {
      id: 'google-sub-123',
      name: { givenName: 'John', familyName: 'Doe' },
      emails: [{ value: 'unverified@gmail.com', verified: false }],
      photos: [{ value: 'https://avatar.url' }],
      _json: { email_verified: false },
    };

    const done = jest.fn();
    await strategy.validate('access', 'refresh', mockProfile as any, done);

    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException), undefined);
  });

  it('chấp nhận tài khoản Google nếu email đã được xác minh', async () => {
    const mockProfile = {
      id: 'google-sub-123',
      name: { givenName: 'John', familyName: 'Doe' },
      emails: [{ value: 'verified@gmail.com', verified: true }],
      photos: [{ value: 'https://avatar.url' }],
      _json: { email_verified: true },
    };

    const done = jest.fn();
    await strategy.validate('access', 'refresh', mockProfile as any, done);

    expect(done).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        provider: 'GOOGLE',
        providerUserId: 'google-sub-123',
        email: 'verified@gmail.com',
        fullName: 'John Doe',
      }),
    );
  });
});
