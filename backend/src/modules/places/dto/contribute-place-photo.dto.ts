import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PLACE_PHOTO_CONTRIBUTION_CONFIG } from '../places.constants';

export class ContributePlacePhotoDto {
  @IsOptional()
  @IsString()
  @MaxLength(PLACE_PHOTO_CONTRIBUTION_CONFIG.MAX_CAPTION_LENGTH)
  caption?: string;
}
