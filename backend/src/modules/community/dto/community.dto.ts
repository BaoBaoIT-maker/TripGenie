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
