import { Injectable, BadRequestException } from '@nestjs/common';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ALLOWED_MEDIA_MIME_TO_EXT,
  COMMUNITY_CONSTANTS,
} from '../community.constants';
import {
  IMediaStorageProvider,
  RawUploadFile,
  UploadedMediaItem,
} from '../interfaces/media-storage.interface';

@Injectable()
export class LocalDiskStorageProvider implements IMediaStorageProvider {
  private readonly targetDir = join(
    process.cwd(),
    COMMUNITY_CONSTANTS.UPLOAD_ROOT_DIR,
    COMMUNITY_CONSTANTS.UPLOAD_SUBDIR,
  );

  // ponytail: local disk storage suits single-node deployments; swap provider binding in CommunityModule to S3/Cloudinary when scaling horizontally.
  async saveFiles(files: RawUploadFile[]): Promise<UploadedMediaItem[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 tệp ảnh hoặc video để tải lên');
    }

    if (files.length > COMMUNITY_CONSTANTS.MAX_FILES_PER_UPLOAD) {
      throw new BadRequestException(
        `Chỉ được tải lên tối đa ${COMMUNITY_CONSTANTS.MAX_FILES_PER_UPLOAD} tệp trong một lần`,
      );
    }

    await mkdir(this.targetDir, { recursive: true });

    const uploadedItems: UploadedMediaItem[] = [];

    for (const file of files) {
      const normalizedMime = (file.mimetype || '').toLowerCase().trim();
      const safeExt = ALLOWED_MEDIA_MIME_TO_EXT[normalizedMime];

      if (!safeExt) {
        throw new BadRequestException(
          `Định dạng tệp "${file.mimetype || file.originalname}" không được hỗ trợ. Chỉ chấp nhận ảnh (JPG, PNG, WebP, GIF) và video (MP4, WebM, MOV).`,
        );
      }

      if (!file.buffer || file.size <= 0) {
        throw new BadRequestException(`Tệp "${file.originalname}" rỗng hoặc không hợp lệ`);
      }

      if (file.size > COMMUNITY_CONSTANTS.MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          `Tệp "${file.originalname}" vượt quá dung lượng tối đa cho phép (50MB)`,
        );
      }

      const fileName = `${randomUUID()}${safeExt}`;
      const fullPath = join(this.targetDir, fileName);

      await writeFile(fullPath, file.buffer);

      uploadedItems.push({
        url: `${COMMUNITY_CONSTANTS.PUBLIC_URL_PREFIX}/${fileName}`,
        mimeType: normalizedMime,
        sizeBytes: file.size,
        mediaType: normalizedMime.startsWith('video/') ? 'VIDEO' : 'IMAGE',
      });
    }

    return uploadedItems;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl || !fileUrl.startsWith(COMMUNITY_CONSTANTS.PUBLIC_URL_PREFIX)) {
      return;
    }
    const safeName = basename(fileUrl);
    if (!safeName) return;

    try {
      await unlink(join(this.targetDir, safeName));
    } catch {
      // Ignore if file was already removed
    }
  }
}
