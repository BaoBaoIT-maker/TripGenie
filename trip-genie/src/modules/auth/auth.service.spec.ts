import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MailService } from './services/mail.service';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUsersRepository: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockMailService: any;

  beforeEach(async () => {
    mockUsersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findIdentity: jest.fn(),
      createIdentity: jest.fn(),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_token'),
      verify: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'JWT_SECRET') return 'secret';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
        return defaultValue;
      }),
    };

    mockMailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: INJECT_TOKENS.USER_REPOSITORY, useValue: mockUsersRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    // Mock internal redisClient methods
    (authService as any).redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue('123456'),
      del: jest.fn().mockResolvedValue(1),
    };
  });

  describe('register', () => {
    it('nên ném ra ConflictException nếu email đã tồn tại và đã verified', async () => {
      mockUsersRepository.findByEmail.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        isVerified: true,
      });

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('nên tạo user mới và gửi mail OTP thành công', async () => {
      mockUsersRepository.findByEmail.mockResolvedValue(null);
      mockUsersRepository.create.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        fullName: 'Test User',
        isVerified: false,
      });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      });

      expect(mockUsersRepository.create).toHaveBeenCalled();
      expect(mockMailService.sendOtpEmail).toHaveBeenCalled();
      expect(result.message).toContain('Mã OTP');
    });
  });

  describe('verifyOtp', () => {
    it('nên ném ra BadRequestException nếu không tìm thấy user', async () => {
      mockUsersRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.verifyOtp({ email: 'unknown@example.com', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên ném ra BadRequestException nếu mã OTP không khớp', async () => {
      mockUsersRepository.findByEmail.mockResolvedValue({ id: '1', email: 'test@example.com' });
      (authService as any).redisClient.get.mockResolvedValue('654321'); // different OTP

      await expect(
        authService.verifyOtp({ email: 'test@example.com', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên xác thực user và trả về tokens khi OTP khớp', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'USER',
        isVerified: true,
      };

      mockUsersRepository.findByEmail.mockResolvedValue(mockUser);
      mockUsersRepository.update.mockResolvedValue(mockUser);
      (authService as any).redisClient.get.mockResolvedValue('123456');

      const result = await authService.verifyOtp({ email: 'test@example.com', otp: '123456' });

      expect(result.tokens).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });
  });
});
