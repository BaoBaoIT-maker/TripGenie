import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn().mockResolvedValue({ message: 'OTP sent' }),
      verifyOtp: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
      login: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
      refreshTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('nên được khởi tạo thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('nên gọi AuthService.register', async () => {
      const dto = { email: 'test@example.com', password: '123', fullName: 'Test' };
      const res = await controller.register(dto);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(res.message).toBe('OTP sent');
    });
  });
});
