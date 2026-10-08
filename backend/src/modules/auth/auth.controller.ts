import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  RefreshTokenDto,
  ResendOtpDto,
  ForgotPasswordDto,
  VerifyResetOtpDto,
  ResetPasswordDto,
  ReauthenticateDto,
  StartGoogleLinkDto,
} from './dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthTokens, UserResponse } from './interfaces/auth.interface';
import { AuthenticatedUser } from '@/common/types';
import { TokenBlacklistService } from './services/token-blacklist.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  private setAuthCookies(res: Response, tokens: AuthTokens) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('oauth_link_nonce', { path: '/' });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResult = await this.authService.register(dto);
    this.setAuthCookies(res, authResult.tokens);
    return authResult;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResult = await this.authService.login(dto);
    this.setAuthCookies(res, authResult.tokens);
    return authResult;
  }

  @Post('reauthenticate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async reauthenticate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReauthenticateDto,
  ) {
    return this.authService.reauthenticate(user.id, dto);
  }

  @Post('google/link/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startGoogleLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartGoogleLinkDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.startGoogleLink(user.id, dto);
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('oauth_link_nonce', result.browserNonce, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });
    return { url: result.url, state: result.state };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const authResult = await this.authService.verifyOtp(dto);
    this.setAuthCookies(res, authResult.tokens);
    return authResult;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resetPassword(dto);
    this.clearAuthCookies(res);
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken || dto.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh Token không tồn tại');
    }

    const tokens = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, tokens);
    return { tokens };
  }

  /**
   * Logout: Robustly clears HttpOnly cookies and attempts to blacklist session tokens.
   * Does NOT reject with 401 when access token is expired, ensuring complete session revocation.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const accessToken = req.cookies?.accessToken || bearerToken;
    const refreshToken = req.cookies?.refreshToken || body?.refreshToken;

    await this.authService.performLogout({ accessToken, refreshToken });
    this.clearAuthCookies(res);
    return { message: 'Đăng xuất thành công' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.authService.getProfile(user.id);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_BASE_URL') ||
      process.env.FRONTEND_BASE_URL ||
      'http://localhost:3000';

    const stateParam = req.query?.state as string | undefined;
    const browserNonce = req.cookies?.oauth_link_nonce;

    // Clear one-time browser nonce cookie
    res.clearCookie('oauth_link_nonce', { path: '/' });

    // Try reading current authenticated user from session if present (checking blacklist)
    let currentUserId: string | undefined;
    const accessToken = req.cookies?.accessToken;
    if (accessToken) {
      try {
        const payload = this.jwtService.verify(accessToken, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        if (payload?.jti) {
          const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(payload.jti);
          if (!isBlacklisted) {
            currentUserId = payload?.sub;
          }
        } else {
          currentUserId = payload?.sub;
        }
      } catch {
        // Access token might be expired, check refresh token
      }
    }

    if (!currentUserId) {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        try {
          const payload = this.jwtService.verify(refreshToken, {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          });
          if (payload?.jti) {
            const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(payload.jti);
            if (!isBlacklisted) {
              currentUserId = payload?.sub;
            }
          } else {
            currentUserId = payload?.sub;
          }
        } catch {
          // Refresh token expired or invalid
        }
      }
    }

    try {
      const result = await this.authService.handleOAuthCallback(req.user, stateParam, {
        browserNonce,
        currentUserId,
      });

      if (result.mode === 'link') {
        const targetPath = result.returnUrl.startsWith('/') ? result.returnUrl : `/${result.returnUrl}`;
        const delimiter = targetPath.includes('?') ? '&' : '?';
        return res.redirect(`${frontendUrl}${targetPath}${delimiter}linked=true`);
      }

      this.setAuthCookies(res, result.authResponse.tokens);
      return res.redirect(`${frontendUrl}/auth/callback?success=true`);
    } catch (err: any) {
      if (stateParam) {
        // Link mode error: never fall back to login!
        const message = err?.message || 'Không thể liên kết tài khoản Google';
        return res.redirect(
          `${frontendUrl}/profile?link_error=${encodeURIComponent(message)}`,
        );
      }

      const errorCode =
        err?.status === 409 ? 'account_collision' : 'oauth_failed';
      return res.redirect(
        `${frontendUrl}/login?error=${errorCode}`,
      );
    }
  }
}
