import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { IUsersRepository } from '@/modules/users/interfaces/users-repository.interface';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto';
import { AuthTokens, AuthResponse, UserResponse } from './interfaces/auth.interface';
import { MailService } from './services/mail.service';
import { User, AuthProvider } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private redisClient: Redis;

  constructor(
    @Inject(INJECT_TOKENS.USER_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    if (redisUrl && redisUrl.startsWith('redis')) {
      this.redisClient = new Redis(redisUrl, { lazyConnect: true });
    } else {
      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        lazyConnect: true,
      });
    }

    this.redisClient.connect().catch((err) => {
      this.logger.warn(`Redis connection warning: ${err.message}. OTP features will fallback.`);
    });
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser && existingUser.isVerified) {
      throw new ConflictException('Email này đã được đăng ký tài khoản');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    let user = existingUser;
    if (!user) {
      user = await this.usersRepository.create({
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        isVerified: false,
      });
    } else {
      user = await this.usersRepository.update(user.id, {
        passwordHash,
        fullName: dto.fullName,
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Redis with 10 min TTL (600s)
    try {
      await this.redisClient.set(`otp:${dto.email.toLowerCase()}`, otp, 'EX', 600);
    } catch (err: any) {
      this.logger.error(`Redis set OTP failed: ${err.message}`);
    }

    // Send email OTP via Gmail SMTP
    await this.mailService.sendOtpEmail(dto.email, otp);

    return {
      message: 'Mã OTP xác thực đã được gửi tới email của bạn. Mã có hiệu lực trong 10 phút.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const user = await this.usersRepository.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản với email này');
    }

    let storedOtp: string | null = null;
    try {
      storedOtp = await this.redisClient.get(`otp:${dto.email.toLowerCase()}`);
    } catch (err: any) {
      this.logger.error(`Redis get OTP failed: ${err.message}`);
    }

    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn');
    }

    // Clear OTP from Redis
    try {
      await this.redisClient.del(`otp:${dto.email.toLowerCase()}`);
    } catch (err) {}

    // Verify user
    const updatedUser = await this.usersRepository.update(user.id, {
      isVerified: true,
      verifiedAt: new Date(),
    });

    const tokens = await this.generateTokens(updatedUser);

    return {
      user: this.formatUserResponse(updatedUser),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersRepository.findByEmail(dto.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Tài khoản chưa được xác thực OTP. Vui lòng xác thực email.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersRepository.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Tài khoản không hợp lệ');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Refresh Token không hợp lệ hoặc đã hết hạn');
    }
  }

  async validateOAuthUser(oauthProfile: {
    provider: string;
    providerUserId: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
  }): Promise<AuthResponse> {
    // 1. Find existing identity
    const existingIdentity = await this.usersRepository.findIdentity(
      oauthProfile.provider,
      oauthProfile.providerUserId,
    );

    let user: User | null = null;

    if (existingIdentity) {
      user = (existingIdentity as any).user || (await this.usersRepository.findById(existingIdentity.userId));
    } else {
      // 2. Find by email
      user = await this.usersRepository.findByEmail(oauthProfile.email);

      if (!user) {
        // Create new user
        user = await this.usersRepository.create({
          email: oauthProfile.email,
          fullName: oauthProfile.fullName,
          avatarUrl: oauthProfile.avatarUrl,
          isVerified: true,
          verifiedAt: new Date(),
        });
      }

      // Create identity link
      await this.usersRepository.createIdentity({
        user: { connect: { id: user.id } },
        provider: oauthProfile.provider as AuthProvider,
        providerUserId: oauthProfile.providerUserId,
        identityData: oauthProfile as any,
      });
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN', '1d') as any),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private formatUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isVerified: user.isVerified,
    };
  }
}
