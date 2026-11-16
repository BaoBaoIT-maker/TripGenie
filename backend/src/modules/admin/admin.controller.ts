import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/types';
import { AdminService } from './admin.service';
import { AdminModerationService } from './admin-moderation.service';
import { QueryAuditLogsDto } from './dto/admin-audit.dto';
import {
  AdminBanUserDto,
  AdminPromoteUserDto,
  AdminRequestMeta,
  QueryAdminUsersDto,
} from './dto/admin-users.dto';
import {
  AdminCreatePlaceDto,
  AdminUpdatePlaceDto,
  QueryAdminPlacesDto,
} from './dto/admin-places.dto';
import {
  AdminCreateCommunityGroupDto,
  AdminUpdateCommunityGroupDto,
  QueryAdminCommunityGroupsDto,
} from './dto/admin-community.dto';
import {
  AdminModeratePostDecisionDto,
  AdminResolveReportDto,
  AdminUpdateModerationConfigDto,
  QueryAdminModerationPostsDto,
  QueryAdminReportsDto,
} from './dto/admin-moderation.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminModerationService: AdminModerationService,
  ) {}

  private extractMeta(req: Request): AdminRequestMeta {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress =
      (Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded?.split(',')[0]?.trim()) ||
      req.ip ||
      null;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null;

    return { ipAddress, userAgent };
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.adminService.getAuditLogs(query);
  }

  @Get('users')
  async getUsers(@Query() query: QueryAdminUsersDto) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id/ban')
  async banUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminBanUserDto,
    @Req() req: Request,
  ) {
    return this.adminService.banUser(admin, id, dto, this.extractMeta(req));
  }

  @Patch('users/:id/unban')
  async unbanUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.unbanUser(admin, id, this.extractMeta(req));
  }

  @Patch('users/:id/promote')
  async promoteUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminPromoteUserDto,
    @Req() req: Request,
  ) {
    return this.adminService.promoteUserToAdmin(
      admin,
      id,
      dto,
      this.extractMeta(req),
    );
  }

  @Get('places')
  async getPlaces(@Query() query: QueryAdminPlacesDto) {
    return this.adminService.getPlaces(query);
  }

  @Post('places')
  async createPlace(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminCreatePlaceDto,
    @Req() req: Request,
  ) {
    return this.adminService.createPlace(admin, dto, this.extractMeta(req));
  }

  @Patch('places/:id')
  async updatePlace(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdatePlaceDto,
    @Req() req: Request,
  ) {
    return this.adminService.updatePlace(admin, id, dto, this.extractMeta(req));
  }

  @Delete('places/:id')
  async deletePlace(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deletePlace(admin, id, this.extractMeta(req));
  }

  @Get('community/groups')
  async getCommunityGroups(@Query() query: QueryAdminCommunityGroupsDto) {
    return this.adminService.getCommunityGroups(query);
  }

  @Post('community/groups')
  async createCommunityGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminCreateCommunityGroupDto,
    @Req() req: Request,
  ) {
    return this.adminService.createCommunityGroup(
      admin,
      dto,
      this.extractMeta(req),
    );
  }

  @Patch('community/groups/:id')
  async updateCommunityGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateCommunityGroupDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateCommunityGroup(
      admin,
      id,
      dto,
      this.extractMeta(req),
    );
  }

  @Delete('community/groups/:id')
  async deleteCommunityGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deleteCommunityGroup(
      admin,
      id,
      this.extractMeta(req),
    );
  }

  @Get('moderation/config')
  async getModerationConfig() {
    return this.adminModerationService.getModerationConfig();
  }

  @Patch('moderation/config')
  async updateModerationConfig(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminUpdateModerationConfigDto,
    @Req() req: Request,
  ) {
    return this.adminModerationService.updateModerationConfig(
      admin,
      dto.aiModerationEnabled,
      this.extractMeta(req),
    );
  }

  @Get('moderation/posts')
  async getModerationPosts(@Query() query: QueryAdminModerationPostsDto) {
    return this.adminModerationService.getModerationPosts(query);
  }

  @Patch('moderation/posts/:id/approve')
  async approvePost(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminModeratePostDecisionDto,
    @Req() req: Request,
  ) {
    return this.adminModerationService.approvePost(
      admin,
      id,
      dto,
      this.extractMeta(req),
    );
  }

  @Patch('moderation/posts/:id/reject')
  async rejectPost(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminModeratePostDecisionDto,
    @Req() req: Request,
  ) {
    return this.adminModerationService.rejectPost(
      admin,
      id,
      dto,
      this.extractMeta(req),
    );
  }

  @Get('moderation/reports')
  async getModerationReports(@Query() query: QueryAdminReportsDto) {
    return this.adminModerationService.getModerationReports(query);
  }

  @Patch('moderation/reports/:id/resolve')
  async resolveReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResolveReportDto,
    @Req() req: Request,
  ) {
    return this.adminModerationService.resolveReport(
      admin,
      id,
      dto,
      this.extractMeta(req),
    );
  }
}
