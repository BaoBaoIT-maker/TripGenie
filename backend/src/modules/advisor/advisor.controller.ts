import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { AdvisorService } from './advisor.service';
import { AdvisorChatDto } from './advisor.types';

@Controller('advisor')
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  /**
   * POST /api/v1/advisor/chat
   * Executes the Agentic RAG AI Travel Advisor conversation turn.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() dto: AdvisorChatDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.advisorService.chat(dto, userId);
  }

  /**
   * GET /api/v1/advisor/sessions
   * Lists recent general AI Advisor sessions for the authenticated user.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('sessions')
  async getSessions(@CurrentUser('id') userId?: string) {
    return this.advisorService.getUserSessions(userId);
  }

  /**
   * GET /api/v1/advisor/sessions/:id/messages
   * Retrieves chronological messages (with places & citations) for a specific session.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('sessions/:id/messages')
  async getSessionMessages(@Param('id', ParseUUIDPipe) sessionId: string) {
    return this.advisorService.getSessionMessages(sessionId);
  }

  /**
   * DELETE /api/v1/advisor/sessions/:id
   * Deletes a chat session and all its associated messages.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('sessions/:id')
  async deleteSession(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.advisorService.deleteSession(sessionId, userId);
  }
}
