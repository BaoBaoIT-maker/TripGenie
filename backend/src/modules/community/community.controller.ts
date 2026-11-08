import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '@/common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/types';
import { COMMUNITY_CONSTANTS } from './community.constants';
import { CommunityService } from './community.service';
import {
  CreateCommunityCommentDto,
  CreateCommunityGroupDto,
  CreateCommunityPostDto,
  QueryCommunityFeedDto,
  ReportCommunityPostDto,
  UpdateCommunityPostDto,
} from './dto/community.dto';
import { RawUploadFile } from './interfaces/media-storage.interface';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post('media/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', COMMUNITY_CONSTANTS.MAX_FILES_PER_UPLOAD, {
      limits: {
        fileSize: COMMUNITY_CONSTANTS.MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadMedia(@UploadedFiles() files: RawUploadFile[]) {
    const result = await this.communityService.uploadMedia(files);
    return {
      message: 'Tải lên tệp đa phương tiện thành công',
      ...result,
    };
  }

  @Get('groups')
  async getGroups() {
    const groups = await this.communityService.getGroups();
    return {
      message: 'Lấy danh sách nhóm cộng đồng thành công',
      groups,
    };
  }

  @Post('groups')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityGroupDto,
  ) {
    const group = await this.communityService.createGroup(
      user.id,
      user.role,
      dto,
    );
    return {
      message: 'Tạo nhóm cộng đồng thành công',
      group,
    };
  }

  @Get('sidebar-discovery')
  @UseGuards(OptionalJwtAuthGuard)
  async getSidebarDiscovery(@CurrentUser('id') viewerId?: string) {
    const result = await this.communityService.getSidebarDiscovery(viewerId);
    return {
      message: 'Lấy dữ liệu khám phá cộng đồng thành công',
      ...result,
    };
  }

  @Get('posts')
  @UseGuards(OptionalJwtAuthGuard)
  async getFeed(
    @Query() query: QueryCommunityFeedDto,
    @CurrentUser('id') viewerId?: string,
  ) {
    const result = await this.communityService.getFeed(query, viewerId);
    return {
      message: 'Lấy bảng tin cộng đồng thành công',
      ...result,
    };
  }

  @Get('posts/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async getPostById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') viewerId?: string,
  ) {
    const post = await this.communityService.getPostById(id, viewerId);
    return {
      message: 'Lấy chi tiết bài viết thành công',
      post,
    };
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityPostDto,
  ) {
    const post = await this.communityService.createPost(user.id, dto);
    return {
      message: 'Đăng bài viết thành công',
      post,
    };
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommunityPostDto,
  ) {
    const post = await this.communityService.updatePost(
      user.id,
      user.role,
      id,
      dto,
    );
    return {
      message: 'Cập nhật bài viết thành công',
      post,
    };
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.communityService.deletePost(user.id, user.role, id);
    return {
      message: 'Đã xóa bài viết',
      ...result,
    };
  }

  @Post('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleLike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.communityService.toggleLike(user.id, id);
    return {
      message: result.isLiked ? 'Đã thích bài viết' : 'Đã bỏ thích bài viết',
      ...result,
    };
  }

  @Post('posts/:id/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async reportPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportCommunityPostDto,
  ) {
    const report = await this.communityService.reportPost(user.id, id, dto);
    return {
      message: report.alreadyReported
        ? 'Bạn đã gửi báo cáo cho bài viết này trước đó'
        : 'Đã gửi báo cáo bài viết cho quản trị viên xem xét',
      report,
    };
  }

  @Get('posts/:id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async getComments(@Param('id', ParseUUIDPipe) id: string) {
    const comments = await this.communityService.getPostComments(id);
    return {
      message: 'Lấy danh sách bình luận thành công',
      comments,
    };
  }

  @Get('posts/:id/comments/:commentId/context')
  @UseGuards(OptionalJwtAuthGuard)
  async getCommentContext(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    const context = await this.communityService.getCommentContext(id, commentId);
    return {
      message: 'Lấy thông tin ngữ cảnh bình luận thành công',
      ...context,
    };
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommunityCommentDto,
  ) {
    const result = await this.communityService.createComment(user.id, id, dto);
    return {
      message: 'Đã gửi bình luận',
      ...result,
    };
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    const result = await this.communityService.deleteComment(
      user.id,
      user.role,
      commentId,
    );
    return {
      message: 'Đã xóa bình luận',
      ...result,
    };
  }

  @Get('creators/:identifier')
  @UseGuards(OptionalJwtAuthGuard)
  async getCreatorProfile(
    @Param('identifier') identifier: string,
    @CurrentUser('id') viewerId?: string,
  ) {
    const profile = await this.communityService.getCreatorProfile(
      identifier,
      viewerId,
    );
    return {
      message: 'Lấy thông tin trang cá nhân thành công',
      profile,
    };
  }
}
