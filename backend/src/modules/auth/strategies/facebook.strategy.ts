import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID', 'dummy_app_id'),
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET', 'dummy_app_secret'),
      callbackURL: configService.get<string>(
        'FACEBOOK_CALLBACK_URL',
        'http://localhost:3000/api/v1/auth/facebook/callback',
      ),
      scope: 'email',
      profileFields: ['id', 'emails', 'name', 'photos'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any, info?: any) => void,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    const user = {
      provider: 'FACEBOOK',
      providerUserId: id,
      email: emails?.[0]?.value || `${id}@facebook.com`,
      fullName: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : 'Facebook User',
      avatarUrl: photos?.[0]?.value,
    };

    done(null, user);
  }
}
