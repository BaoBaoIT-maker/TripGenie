import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeService } from './knowledge.service';
import { INJECT_TOKENS } from '../../common/constants/inject-tokens';
import { IEmbeddingService } from '../places/interfaces/embedding-service.interface';
import { IKnowledgeRepository } from './knowledge.repository';
import { parseFrontmatter, createSemanticChunks } from './markdown-chunker';

describe('Knowledge Module (Clean SOLID Architecture)', () => {
  describe('markdown-chunker (Pure Functions)', () => {
    it('should correctly parse YAML frontmatter and body without external libs', () => {
      const rawMarkdown = `---
title: "Cẩm Nang Đà Nẵng"
source_type: "curated_guide"
area_slug: "da-nang"
category_tags: ["beach", "food"]
---

# Tiêu đề lớn
Đoạn mở đầu.

## 1. Ẩm thực
Mì Quảng Đà Nẵng rất ngon.
`;
      const parsed = parseFrontmatter(rawMarkdown);
      expect(parsed.frontmatter.title).toBe('Cẩm Nang Đà Nẵng');
      expect(parsed.frontmatter.area_slug).toBe('da-nang');
      expect(parsed.frontmatter.category_tags).toEqual(['beach', 'food']);
      expect(parsed.body).toContain('## 1. Ẩm thực');
    });

    it('should create semantic chunks with breadcrumbs injected', () => {
      const docTitle = 'Cẩm Nang Đà Nẵng';
      const body = `
## 1. Bán đảo Sơn Trà
Rừng nguyên sinh Sơn Trà là lá phổi xanh của thành phố.

### Quy định xe máy tay ga
Ban quản lý cấm xe máy tay ga từ trạm Vọng Cảnh lên Đỉnh Bàn Cờ để tránh nguy cơ cháy phanh khi xuống dốc.
`;
      const chunks = createSemanticChunks(docTitle, body, {
        categoryTags: ['safety', 'son-tra'],
        areaSlug: 'da-nang',
      });

      expect(chunks.length).toBeGreaterThanOrEqual(2);

      const scooterChunk = chunks.find((c) =>
        c.metadata.sectionTitle.includes('Quy định xe máy tay ga'),
      );
      expect(scooterChunk).toBeDefined();
      expect(scooterChunk!.content).toContain(
        '[Ngữ cảnh: Cẩm Nang Đà Nẵng > 1. Bán đảo Sơn Trà > Quy định xe máy tay ga]',
      );
      expect(scooterChunk!.metadata.areaSlug).toBe('da-nang');
      expect(scooterChunk!.metadata.categoryTags).toEqual(['safety', 'son-tra']);
    });
  });

  describe('KnowledgeService (Orchestrator)', () => {
    let service: KnowledgeService;
    let mockRepo: jest.Mocked<IKnowledgeRepository>;
    let mockEmbeddingService: jest.Mocked<IEmbeddingService>;

    beforeEach(async () => {
      mockRepo = {
        findDocumentBySourceUrl: jest.fn(),
        upsertDocumentWithChunks: jest.fn(),
        searchSimilarChunks: jest.fn(),
        findAreaIdBySlug: jest.fn(),
      };

      mockEmbeddingService = {
        generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.01)),
        getModelName: jest.fn().mockReturnValue('models/gemini-embedding-2'),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KnowledgeService,
          {
            provide: INJECT_TOKENS.KNOWLEDGE_REPOSITORY,
            useValue: mockRepo,
          },
          {
            provide: INJECT_TOKENS.EMBEDDING_SERVICE,
            useValue: mockEmbeddingService,
          },
        ],
      }).compile();

      service = module.get<KnowledgeService>(KnowledgeService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    describe('searchKnowledge', () => {
      it('should generate embedding for query and delegate to repository', async () => {
        mockRepo.searchSimilarChunks.mockResolvedValue([
          {
            chunk_id: 'c-1',
            document_id: 'd-1',
            chunk_index: 0,
            content: 'Ban quản lý cấm xe máy tay ga...',
            metadata: {
              sectionTitle: 'Quy định xe máy',
              breadcrumbs: 'Đà Nẵng > Sơn Trà',
              categoryTags: ['safety'],
            },
            document_title: 'Cẩm Nang Đà Nẵng',
            source_type: 'curated_guide',
            source_url: 'data/knowledge/02-da-nang.md',
            area_id: 48,
            similarity_score: 0.88,
          },
        ]);

        const results = await service.searchKnowledge('Lên Sơn Trà có được đi xe ga?', {
          areaId: 48,
          minSimilarity: 0.25,
        });

        expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
          'Lên Sơn Trà có được đi xe ga?',
        );
        expect(mockRepo.searchSimilarChunks).toHaveBeenCalledWith(
          expect.any(Array),
          { areaId: 48, minSimilarity: 0.25 },
        );
        expect(results.length).toBe(1);
        expect(results[0].similarity_score).toBe(0.88);
      });
    });
  });
});
