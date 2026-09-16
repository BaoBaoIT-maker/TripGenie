import { Injectable } from '@nestjs/common';
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
    const { id, name, emails, photos } = profile;

    const user = {
      provider: 'GOOGLE',
      providerUserId: id,
      email: emails?.[0]?.value || '',
      fullName: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : 'Google User',
      avatarUrl: photos?.[0]?.value,
    };

    done(null, user);
  }
}
