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

export interface IMediaStorageProvider {
  saveFiles(files: RawUploadFile[]): Promise<UploadedMediaItem[]>;
  deleteFile?(fileUrl: string): Promise<void>;
}
