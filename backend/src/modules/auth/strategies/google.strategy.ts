import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID', 'dummy_client_id'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', 'dummy_client_secret'),
      callbackURL: configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3000/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos, _json } = profile as any;
    const emailObj = emails?.[0];
    const email = (emailObj?.value || _json?.email || '').toLowerCase().trim();

    // Check Google verified email claim
    const isEmailVerified =
      emailObj?.verified === true ||
      _json?.email_verified === true ||
      _json?.email_verified === 'true';

    if (!email) {
      return done(
        new UnauthorizedException('Không tìm thấy địa chỉ email từ tài khoản Google'),
        undefined,
      );
    }

    if (!isEmailVerified) {
      return done(
        new UnauthorizedException('Địa chỉ email từ tài khoản Google chưa được xác minh'),
        undefined,
      );
    }

    const user = {
      provider: 'GOOGLE',
      providerUserId: id,
      email,
      fullName: name
        ? `${name.givenName || ''} ${name.familyName || ''}`.trim()
        : _json?.name || 'Google User',
      avatarUrl: photos?.[0]?.value || _json?.picture,
    };

    done(null, user);
  }
}
