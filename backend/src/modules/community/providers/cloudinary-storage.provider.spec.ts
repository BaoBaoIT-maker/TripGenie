import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { PassThrough } from 'node:stream';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { RawUploadFile } from '../interfaces/media-storage.interface';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('CloudinaryStorageProvider', () => {
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createProvider = (
    configOverrides: Record<string, string | undefined> = {},
  ) => {
    const configMap: Record<string, string | undefined> = {
      CLOUDINARY_CLOUD_NAME: 'test_cloud',
      CLOUDINARY_API_KEY: 'test_key',
      CLOUDINARY_API_SECRET: 'test_secret',
      ...configOverrides,
    };

    mockConfigService = {
      get: jest.fn((key: string) => configMap[key]),
    } as unknown as jest.Mocked<ConfigService>;

    return new CloudinaryStorageProvider(mockConfigService);
  };

  it('initializes cloudinary config when credentials are present', () => {
    createProvider();
    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'test_cloud',
      api_key: 'test_key',
      api_secret: 'test_secret',
      secure: true,
    });
  });

  it('throws ServiceUnavailableException on upload when credentials are missing', async () => {
    const provider = createProvider({ CLOUDINARY_CLOUD_NAME: undefined });
    const file: RawUploadFile = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake image content'),
    };

    await expect(provider.saveFiles([file])).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws BadRequestException for unsupported file format', async () => {
    const provider = createProvider();
    const file: RawUploadFile = {
      originalname: 'malicious.exe',
      mimetype: 'application/x-msdownload',
      size: 1024,
      buffer: Buffer.from('fake'),
    };

    await expect(provider.saveFiles([file])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when file buffer is empty', async () => {
    const provider = createProvider();
    const file: RawUploadFile = {
      originalname: 'empty.jpg',
      mimetype: 'image/jpeg',
      size: 0,
      buffer: Buffer.alloc(0),
    };

    await expect(provider.saveFiles([file])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('uploads valid image file to Cloudinary and returns item metadata', async () => {
    const provider = createProvider();
    const file: RawUploadFile = {
      originalname: 'trip.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
      buffer: Buffer.from('image bytes'),
    };

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (
        _options: unknown,
        callback: (err: Error | null, result?: unknown) => void,
      ) => {
        const stream = new PassThrough();
        process.nextTick(() => {
          callback(null, {
            secure_url:
              'https://res.cloudinary.com/test_cloud/image/upload/v123/tripgenie/community/trip.jpg',
            bytes: 2048,
          });
        });
        return stream;
      },
    );

    const results = await provider.saveFiles([file]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      url: 'https://res.cloudinary.com/test_cloud/image/upload/v123/tripgenie/community/trip.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      mediaType: 'IMAGE',
    });
  });

  it('uploads video file with resource_type = video', async () => {
    const provider = createProvider();
    const file: RawUploadFile = {
      originalname: 'video.mp4',
      mimetype: 'video/mp4',
      size: 10000,
      buffer: Buffer.from('video bytes'),
    };

    let capturedOptions: Record<string, unknown> = {};
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (
        options: Record<string, unknown>,
        callback: (err: Error | null, result?: unknown) => void,
      ) => {
        capturedOptions = options;
        const stream = new PassThrough();
        process.nextTick(() => {
          callback(null, {
            secure_url:
              'https://res.cloudinary.com/test_cloud/video/upload/v123/tripgenie/community/video.mp4',
            bytes: 10000,
          });
        });
        return stream;
      },
    );

    const results = await provider.saveFiles([file]);

    expect(capturedOptions.resource_type).toBe('video');
    expect(results[0].mediaType).toBe('VIDEO');
  });

  it('throws ServiceUnavailableException when Cloudinary upload stream fails', async () => {
    const provider = createProvider();
    const file: RawUploadFile = {
      originalname: 'trip.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
      buffer: Buffer.from('image bytes'),
    };

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      (
        _options: unknown,
        callback: (err: Error | null, result?: unknown) => void,
      ) => {
        const stream = new PassThrough();
        process.nextTick(() => {
          callback(new Error('Cloudinary server unavailable'), null);
        });
        return stream;
      },
    );

    await expect(provider.saveFiles([file])).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('deletes file from Cloudinary by extracting publicId', async () => {
    const provider = createProvider();
    const fileUrl =
      'https://res.cloudinary.com/test_cloud/image/upload/v1731720000/tripgenie/community/sample_photo.jpg';

    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({
      result: 'ok',
    });

    await provider.deleteFile(fileUrl);

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      'tripgenie/community/sample_photo',
      { resource_type: 'image' },
    );
  });
});
