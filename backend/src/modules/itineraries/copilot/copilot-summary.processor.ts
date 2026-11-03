import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { COPILOT_SUMMARY_QUEUE } from './copilot.types';
import { CopilotAgentService } from './copilot-agent.service';

export interface SummarizeJobData {
  sessionId: string;
}

@Processor(COPILOT_SUMMARY_QUEUE)
export class CopilotSummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(CopilotSummaryProcessor.name);

  constructor(private readonly copilotAgentService: CopilotAgentService) {
    super();
  }

  async process(job: Job<SummarizeJobData>): Promise<string | null> {
    this.logger.log(`[BullMQ] Processing summary job #${job.id} for session ${job.data.sessionId}`);
    try {
      const result = await this.copilotAgentService.summarizeSession(job.data.sessionId);
      this.logger.log(`[BullMQ] Finished summary job #${job.id} for session ${job.data.sessionId}`);
      return result;
    } catch (err) {
      this.logger.error(`[BullMQ] Failed summary job #${job.id}: ${(err as Error).message}`);
      throw err;
    }
  }
}
