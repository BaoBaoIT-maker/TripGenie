import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailService } from './services/mail.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { UsersModule } from '../users/users.module';

import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
import { AuthMailProcessor } from './processors/auth-mail.processor';
import { AUTH_CONSTANTS } from '@/common/constants/auth.constants';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    BullModule.registerQueue({
      name: AUTH_CONSTANTS.MAIL_QUEUE,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    OtpService,
    PasswordResetService,
    TokenBlacklistService,
    AuthMailProcessor,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
  ],
  exports: [AuthService, OtpService, PasswordResetService, TokenBlacklistService],
})
export class AuthModule {}
