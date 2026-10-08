import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';

describe('OtpService', () => {
  let otpService: OtpService;
  let mockRedisClient: any;
  let mockConfigService: any;
  let mockMailService: any;

  beforeEach(async () => {
    mockRedisClient = {
      ttl: jest.fn().mockResolvedValue(-2),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test_otp_secret_key_1234567890'),
    };

    mockMailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: 'REDIS_CLIENT', useValue: mockRedisClient },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    otpService = module.get<OtpService>(OtpService);
  });

  describe('generateAndSendOtp', () => {
    it('nên ném ra BadRequestException nếu cooldown vẫn còn hiệu lực', async () => {
      mockRedisClient.ttl.mockResolvedValue(45); // 45 seconds left

      await expect(
        otpService.generateAndSendOtp('user@example.com', 'email-verification'),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên ném ra BadRequestException nếu vượt quá giới hạn gửi trong 1 giờ', async () => {
      mockRedisClient.incr.mockResolvedValue(6); // 6th request (> 5)

      await expect(
        otpService.generateAndSendOtp('user@example.com', 'email-verification'),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên tạo challenge và gửi email khi hợp lệ', async () => {
      const result = await otpService.generateAndSendOtp('user@example.com', 'email-verification');

      expect(mockRedisClient.set).toHaveBeenCalledTimes(2); // challenge + cooldown
      expect(mockMailService.sendOtpEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
        'email-verification',
      );
      expect(result.expiresIn).toBe(600);
      expect(result.retryAfter).toBe(60);
    });

    it('nên rollback challenge và ném ServiceUnavailableException nếu SMTP lỗi', async () => {
      mockMailService.sendOtpEmail.mockResolvedValue(false);

      await expect(
        otpService.generateAndSendOtp('user@example.com', 'email-verification'),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('nên ném BadRequestException nếu mã OTP không tồn tại hoặc hết hạn', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        otpService.verifyOtp('user@example.com', '123456', 'email-verification'),
      ).rejects.toThrow(BadRequestException);
    });

    it('nên tăng attempts nếu mã OTP không đúng', async () => {
      const challenge = {
        otpHash: (otpService as any).hashOtp('654321'),
        attempts: 0,
        maxAttempts: 5,
        createdAt: Date.now(),
        expiresAt: Date.now() + 600000,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(challenge));
      mockRedisClient.ttl.mockResolvedValue(500);

      await expect(
        otpService.verifyOtp('user@example.com', '123456', 'email-verification'),
      ).rejects.toThrow(/Mã OTP không chính xác/);

      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('nên consume mã OTP và xóa challenge khi nhập đúng', async () => {
      const rawOtp = '123456';
      const challenge = {
        otpHash: (otpService as any).hashOtp(rawOtp),
        attempts: 0,
        maxAttempts: 5,
        createdAt: Date.now(),
        expiresAt: Date.now() + 600000,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(challenge));

      const result = await otpService.verifyOtp('user@example.com', rawOtp, 'email-verification');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        expect.stringContaining('otp:challenge:email-verification:user@example.com'),
      );
    });
  });
});
