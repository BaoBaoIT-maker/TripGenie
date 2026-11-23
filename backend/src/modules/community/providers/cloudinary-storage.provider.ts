import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'node:stream';
import {
  ALLOWED_MEDIA_MIME_TO_EXT,
  COMMUNITY_CONSTANTS,
} from '../community.constants';
import {
  IMediaStorageProvider,
  MediaUploadOptions,
  RawUploadFile,
  UploadedMediaItem,
} from '../interfaces/media-storage.interface';

@Injectable()
export class CloudinaryStorageProvider implements IMediaStorageProvider {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log(
        `Cloudinary storage provider initialized (cloud_name: ${cloudName})`,
      );
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'Cloudinary credentials missing in environment variables. Uploads will fail unless configured.',
      );
    }
  }

  // ponytail: uploads directly to Cloudinary folder via stream; fail-fast with clean HTTP 503 if remote is unavailable rather than silent ephemeral fallback
  async saveFiles(
    files: RawUploadFile[],
    options?: MediaUploadOptions,
  ): Promise<UploadedMediaItem[]> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Dịch vụ lưu trữ Cloudinary chưa được cấu hình đầy đủ API Key/Secret.',
      );
    }

    const imageOnly = options?.imageOnly ?? false;
    const maxFiles = options?.maxFiles ?? COMMUNITY_CONSTANTS.MAX_FILES_PER_UPLOAD;
    const maxFileSizeBytes =
      options?.maxFileSizeBytes ?? COMMUNITY_CONSTANTS.MAX_FILE_SIZE_BYTES;
    const targetFolder = options?.folder ?? COMMUNITY_CONSTANTS.CLOUDINARY_FOLDER;

    if (!files || files.length === 0) {
      throw new BadRequestException(
        imageOnly
          ? 'Vui lòng chọn ít nhất 1 tệp hình ảnh để tải lên'
          : 'Vui lòng chọn ít nhất 1 tệp ảnh hoặc video để tải lên',
      );
    }

    if (files.length > maxFiles) {
      throw new BadRequestException(
        `Chỉ được tải lên tối đa ${maxFiles} tệp trong một lần`,
      );
    }

    const uploadedItems: UploadedMediaItem[] = [];

    for (const file of files) {
      const normalizedMime = (file.mimetype || '').toLowerCase().trim();
      const safeExt = ALLOWED_MEDIA_MIME_TO_EXT[normalizedMime];
      const isVideo = normalizedMime.startsWith('video/');

      if (imageOnly && isVideo) {
        throw new BadRequestException(
          'Không hỗ trợ tải lên video. Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WebP).',
        );
      }

      if (!safeExt || (imageOnly && !normalizedMime.startsWith('image/'))) {
        throw new BadRequestException(
          imageOnly
            ? `Định dạng tệp "${file.mimetype || file.originalname}" không được hỗ trợ. Chỉ chấp nhận hình ảnh (JPG, PNG, WebP, GIF).`
            : `Định dạng tệp "${file.mimetype || file.originalname}" không được hỗ trợ. Chỉ chấp nhận ảnh (JPG, PNG, WebP, GIF) và video (MP4, WebM, MOV).`,
        );
      }

      if (!file.buffer || file.size <= 0) {
        throw new BadRequestException(
          `Tệp "${file.originalname}" rỗng hoặc không hợp lệ`,
        );
      }

      if (file.size > maxFileSizeBytes) {
        const maxMb = Math.round(maxFileSizeBytes / (1024 * 1024));
        throw new BadRequestException(
          `Tệp "${file.originalname}" vượt quá dung lượng tối đa cho phép (${maxMb}MB)`,
        );
      }

      const resourceType: 'image' | 'video' = isVideo ? 'video' : 'image';

      try {
        const uploadResult = await this.uploadToCloudinary(
          file.buffer,
          resourceType,
          targetFolder,
        );

        uploadedItems.push({
          url: uploadResult.secure_url,
          mimeType: normalizedMime,
          sizeBytes: uploadResult.bytes || file.size,
          mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Cloudinary upload failed for "${file.originalname}": ${errorMessage}`,
          err instanceof Error ? err.stack : undefined,
        );
        throw new ServiceUnavailableException(
          'Dịch vụ lưu trữ đám mây đang gián đoạn hoặc không thể tải tệp lên. Vui lòng thử lại sau.',
        );
      }
    }

    return uploadedItems;
  }

  private uploadToCloudinary(
    buffer: Buffer,
    resourceType: 'image' | 'video',
    folder: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
            const message =
              typeof error === 'object' && error !== null && 'message' in error
                ? String((error as { message?: unknown }).message)
                : 'Cloudinary upload error';
            return reject(new Error(message));
          }
          if (!result) {
            return reject(new Error('Cloudinary returned empty response'));
          }
          resolve(result);
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!this.isConfigured || !fileUrl || !fileUrl.includes('cloudinary.com')) {
      return;
    }

    try {
      const publicId = this.extractPublicId(fileUrl);
      if (publicId) {
        const isVideo = fileUrl.includes('/video/');
        await cloudinary.uploader.destroy(publicId, {
          resource_type: isVideo ? 'video' : 'image',
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to delete Cloudinary file "${fileUrl}": ${errorMessage}`,
      );
    }
  }

  private extractPublicId(url: string): string | null {
    try {
      const uploadIdx = url.indexOf('/upload/');
      if (uploadIdx === -1) return null;
      let pathAfterUpload = url.substring(uploadIdx + '/upload/'.length);
      pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
      const lastDotIdx = pathAfterUpload.lastIndexOf('.');
      if (lastDotIdx !== -1) {
        pathAfterUpload = pathAfterUpload.substring(0, lastDotIdx);
      }
      return pathAfterUpload || null;
    } catch {
      return null;
    }
  }
}
