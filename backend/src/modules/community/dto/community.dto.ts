import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType } from '@prisma/client';
import { COMMUNITY_CONSTANTS, CommunitySortMode } from '../community.constants';

export class QueryCommunityFeedDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COMMUNITY_CONSTANTS.MAX_FEED_LIMIT)
  limit?: number = COMMUNITY_CONSTANTS.DEFAULT_FEED_LIMIT;

  @IsOptional()
  @IsEnum(CommunitySortMode)
  sort?: CommunitySortMode = CommunitySortMode.LATEST;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_GROUP_SLUG_LENGTH)
  groupId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  areaId?: number;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_TAG_LENGTH)
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_SEARCH_LENGTH)
  search?: string;
}

export class CreateCommunityPostDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề bài viết không được để trống' })
  @MaxLength(COMMUNITY_CONSTANTS.MAX_TITLE_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_CAPTION_LENGTH)
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(COMMUNITY_CONSTANTS.MAX_FILES_PER_UPLOAD)
  mediaUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(COMMUNITY_CONSTANTS.MAX_TAGS_COUNT)
  tags?: string[];

  @IsOptional()
  @IsUUID()
  itineraryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_GROUP_SLUG_LENGTH)
  groupId?: string;
}

export class UpdateCommunityPostDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề bài viết không được để trống' })
  @MaxLength(COMMUNITY_CONSTANTS.MAX_TITLE_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_CAPTION_LENGTH)
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(COMMUNITY_CONSTANTS.MAX_TAGS_COUNT)
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_GROUP_SLUG_LENGTH)
  groupId?: string;
}

export class CreateCommunityCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
  @MaxLength(COMMUNITY_CONSTANTS.MAX_COMMENT_LENGTH)
  content!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_REPLY_TO_NAME_LENGTH)
  replyToName?: string;
}

export class ReportCommunityPostDto {
  @IsEnum(ReportType, { message: 'Loại báo cáo không hợp lệ' })
  reportType!: ReportType;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_REPORT_DESCRIPTION_LENGTH)
  description?: string;
}

export class CreateCommunityGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên nhóm cộng đồng không được để trống' })
  @MaxLength(COMMUNITY_CONSTANTS.MAX_GROUP_NAME_LENGTH)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_GROUP_SLUG_LENGTH)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_GROUP_SUBTITLE_LENGTH)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMUNITY_CONSTANTS.MAX_GROUP_DESCRIPTION_LENGTH)
  description?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
