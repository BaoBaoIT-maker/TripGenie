import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../services/mail.service';
import { AUTH_CONSTANTS } from '@/common/constants/auth.constants';

export interface SendVerificationMailJobData {
  email: string;
  verificationUrl: string;
}

@Processor(AUTH_CONSTANTS.MAIL_QUEUE)
export class AuthMailProcessor extends WorkerHost {
  private readonly logger = new Logger(AuthMailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendVerificationMailJobData>): Promise<boolean> {
    this.logger.log(`[BullMQ] Processing verification email job #${job.id} for ${job.data.email}`);
    const sent = await this.mailService.sendVerificationLinkEmail(
      job.data.email,
      job.data.verificationUrl,
    );

    if (!sent) {
      this.logger.error(`[BullMQ] Failed to send verification email to ${job.data.email}`);
      throw new Error(`Failed to send verification email to ${job.data.email}`);
    }

    this.logger.log(`[BullMQ] Successfully sent verification email to ${job.data.email}`);
    return true;
  }
}
