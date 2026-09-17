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

  async sendOtpEmail(toEmail: string, otp: string): Promise<boolean> {
    const sender = this.configService.get<string>('EMAIL_USER');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; borderRadius: 10px;">
        <h2 style="color: #2b6cb0; text-align: center;">Mã Xác Thực TripGenie</h2>
        <p>Xin chào,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>TripGenie</strong> — Nền tảng Lập kế hoạch Du lịch Thông minh.</p>
        <p>Mã OTP xác thực tài khoản của bạn là:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2b6cb0; background-color: #ebf8ff; padding: 10px 20px; border-radius: 8px;">${otp}</span>
        </div>
        <p>Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #718096; text-align: center;">Đây là email tự động, vui lòng không phản hồi email này.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"TripGenie Support" <${sender}>`,
        to: toEmail,
        subject: `[TripGenie] Mã OTP xác thực tài khoản: ${otp}`,
        html: htmlContent,
      });

      this.logger.log(`Email OTP sent successfully to ${toEmail}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send OTP email to ${toEmail}: ${error.message}`, error.stack);
      // Fail-soft: Don't crash registration in dev environment if SMTP fails
      return false;
    }
  }
}
