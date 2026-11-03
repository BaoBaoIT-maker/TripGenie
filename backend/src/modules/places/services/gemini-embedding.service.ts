import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IEmbeddingService } from '../interfaces/embedding-service.interface';

@Injectable()
export class GeminiEmbeddingService implements IEmbeddingService {
  private readonly logger = new Logger(GeminiEmbeddingService.name);
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly httpClient: AxiosInstance;
  private readonly targetDimensions = 1536; // Matches PostgreSQL VECTOR(1536) schema

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.modelName = this.configService.get<string>(
      'GEMINI_EMBEDDING_MODEL',
      'models/gemini-embedding-2',
    );

    this.httpClient = axios.create({
      timeout: 15000,
    });
  }

  getModelName(): string {
    return this.modelName;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('Input text for embedding cannot be empty');
    }

    const cleanText = text.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/${this.modelName}:embedContent?key=${this.apiKey}`;

    try {
      const response = await this.httpClient.post(url, {
        model: this.modelName,
        content: {
          parts: [{ text: cleanText }],
        },
        outputDimensionality: this.targetDimensions,
      });

      const values: number[] | undefined = response.data?.embedding?.values;
      if (!values || !Array.isArray(values) || values.length === 0) {
        throw new Error('Gemini API returned empty embedding vector');
      }

      return values;
    } catch (error: any) {
      const status = error.response?.status;
      const details = error.response?.data?.error?.message || error.message;
      this.logger.error(`Failed to generate embedding (status: ${status}): ${details}`);
      throw new InternalServerErrorException(`Gemini Embedding error: ${details}`);
    }
  }
}
