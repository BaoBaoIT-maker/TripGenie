import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
  ): Promise<boolean> {
    const sender = this.configService.get<string>('EMAIL_USER');
    const isReset = purpose === 'password-reset';

    const subject = isReset
      ? `[TripGenie] Mã OTP đặt lại mật khẩu: ${otp}`
      : `[TripGenie] Mã OTP xác thực tài khoản: ${otp}`;

    const title = isReset ? 'Đặt Lại Mật Khẩu TripGenie' : 'Mã Xác Thực TripGenie';
    const message = isReset
      ? 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>TripGenie</strong>.'
      : 'Cảm ơn bạn đã đăng ký tài khoản tại <strong>TripGenie</strong> — Nền tảng Lập kế hoạch Du lịch Thông minh.';

    const note = isReset
      ? 'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ hỗ trợ để bảo mật tài khoản.'
      : 'Vui lòng không chia sẻ mã này với bất kỳ ai để đảm bảo an toàn cho tài khoản của bạn.';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
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
            <p>Xin chào,</p>
            <p>${message}</p>
            <div class="otp-badge">
              <div class="otp-code">${otp}</div>
            </div>
            <p style="margin-bottom: 8px;">Mã OTP có hiệu lực trong vòng <strong>10 phút</strong>.</p>
            <p style="color: #64748b; font-size: 14px;">${note}</p>
          </div>
          <div class="footer">
            <p style="margin: 0;">Đây là email tự động từ hệ thống TripGenie, vui lòng không phản hồi thư này.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (!sender || sender.includes('mock_email')) {
        this.logger.warn(`Mock email configured (${sender}) — OTP code: ${otp}`);
        // Return true in development to allow smooth testing unless testing failures
        return true;
      }

      await this.transporter.sendMail({
        from: `"TripGenie" <${sender}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });

      this.logger.log(`Email OTP sent successfully to ${toEmail} for ${purpose}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send OTP email to ${toEmail}: ${error.message}`, error.stack);
      return false;
    }
  }
}
