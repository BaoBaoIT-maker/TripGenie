import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '@/common/types';
import { INJECT_TOKENS } from '@/common/constants/inject-tokens';
import { IUsersRepository } from '@/modules/users/interfaces/users-repository.interface';
import { TokenBlacklistService } from '../services/token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(INJECT_TOKENS.USER_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req?.cookies?.accessToken) return req.cookies.accessToken;
          return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'your_super_secret_jwt_key_min_32_characters'),
      passReqToCallback: false,
    });
  }

  /**
   * Called by Passport after the JWT signature is verified and not expired.
   * We additionally check the Redis blacklist to handle logged-out tokens.
   */
  async validate(payload: JwtPayload) {
    // 1. Check blacklist (revoked on logout)
    if (payload.jti) {
      const revoked = await this.tokenBlacklistService.isBlacklisted(payload.jti);
      if (revoked) {
        throw new UnauthorizedException('Token đã bị thu hồi, vui lòng đăng nhập lại');
      }
    }

    // 2. Verify user still exists and is active
    const user = await this.usersRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    // Return jti + exp so logout can revoke without re-decoding the token
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      jti: payload.jti ?? '',
      exp: payload.exp ?? 0,
    };
  }
}
