import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppLocale, DEFAULT_LOCALE } from '../../../common/i18n/locale.util';
import { t } from '../../../common/i18n/t.util';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('EMAIL_PORT', 465);
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendOtpEmail(
    toEmail: string,
    otp: string,
    purpose: 'email-verification' | 'password-reset' = 'email-verification',
    locale: AppLocale = DEFAULT_LOCALE,
  ): Promise<boolean> {
    const sender = this.configService.get<string>('EMAIL_USER');
    const isReset = purpose === 'password-reset';

    const subject = t(
      locale,
      isReset ? 'mail.otp.resetSubject' : 'mail.otp.verifySubject',
      { otp },
    );
    const title = t(
      locale,
      isReset ? 'mail.otp.resetTitle' : 'mail.otp.verifyTitle',
    );
    const greeting = t(locale, 'mail.common.greeting');
    const message = t(
      locale,
      isReset ? 'mail.otp.resetMessage' : 'mail.otp.verifyMessage',
    );
    const expiryLine = t(locale, 'mail.otp.expiry');
    const note = t(
      locale,
      isReset ? 'mail.otp.resetNote' : 'mail.otp.verifyNote',
    );
    const footer = t(locale, 'mail.common.footer');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${locale}">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 32px 24px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 28px; color: #334155; line-height: 1.6; }
          .otp-badge { text-align: center; margin: 28px 0; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0d9488; background-color: #f0fdfa; padding: 14px 28px; border-radius: 12px; border: 1px dashed #99f6e4; display: inline-block; font-family: monospace; }
          .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TripGenie</h1>
          </div>
          <div class="content">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${title}</h2>
            <p>${greeting}</p>
            <p>${message}</p>
            <div class="otp-badge">
              <div class="otp-code">${otp}</div>
            </div>
            <p style="margin-bottom: 8px;">${expiryLine}</p>
            <p style="color: #64748b; font-size: 14px;">${note}</p>
          </div>
          <div class="footer">
            <p style="margin: 0;">${footer}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (!sender || sender.includes('mock_email')) {
        this.logger.warn(
          `Mock email configured (${sender}) — OTP code: ${otp}`,
        );
        // Return true in development to allow smooth testing unless testing failures
        return true;
      }

      await this.transporter.sendMail({
        from: `"TripGenie" <${sender}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });

      this.logger.log(
        `Email OTP sent successfully to ${toEmail} for ${purpose} (${locale})`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to send OTP email to ${toEmail}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async sendVerificationLinkEmail(
    toEmail: string,
    verificationUrl: string,
    locale: AppLocale = DEFAULT_LOCALE,
  ): Promise<boolean> {
    const sender = this.configService.get<string>('EMAIL_USER');
    const subject = t(locale, 'mail.verification.subject');
    const heading = t(locale, 'mail.verification.heading');
    const greeting = t(locale, 'mail.common.greeting');
    const intro = t(locale, 'mail.verification.intro');
    const instruction = t(locale, 'mail.verification.instruction');
    const ctaLabel = t(locale, 'mail.verification.cta');
    const expiry = t(locale, 'mail.verification.expiry');
    const fallbackLinkLabel = t(locale, 'mail.verification.fallbackLink');
    const footer = t(locale, 'mail.common.footer');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${locale}">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 32px 24px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 28px; color: #334155; line-height: 1.6; }
          .btn-box { text-align: center; margin: 32px 0; }
          .btn { background-color: #0d9488; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-block; font-size: 15px; }
          .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TripGenie</h1>
          </div>
          <div class="content">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${heading}</h2>
            <p>${greeting}</p>
            <p>${intro}</p>
            <p>${instruction}</p>
            <div class="btn-box">
              <a href="${verificationUrl}" target="_blank" class="btn">${ctaLabel}</a>
            </div>
            <p style="margin-bottom: 8px;">${expiry}</p>
            <p style="color: #64748b; font-size: 13px;">${fallbackLinkLabel}<br/><a href="${verificationUrl}" style="color: #0d9488; word-break: break-all;">${verificationUrl}</a></p>
          </div>
          <div class="footer">
            <p style="margin: 0;">${footer}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (!sender || sender.includes('mock_email')) {
        this.logger.warn(
          `Mock email configured (${sender}) — Verification URL: ${verificationUrl}`,
        );
        return true;
      }

      await this.transporter.sendMail({
        from: `"TripGenie" <${sender}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });

      this.logger.log(
        `Email verification link sent successfully to ${toEmail} (${locale})`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to send verification email to ${toEmail}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
