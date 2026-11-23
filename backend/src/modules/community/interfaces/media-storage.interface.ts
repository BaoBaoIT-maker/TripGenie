export interface UploadedMediaItem {
  url: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: 'IMAGE' | 'VIDEO';
}

export interface RawUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface MediaUploadOptions {
  folder?: string;
  imageOnly?: boolean;
  maxFileSizeBytes?: number;
  maxFiles?: number;
}

export interface IMediaStorageProvider {
  saveFiles(
    files: RawUploadFile[],
    options?: MediaUploadOptions,
  ): Promise<UploadedMediaItem[]>;
  deleteFile?(fileUrl: string): Promise<void>;
}
