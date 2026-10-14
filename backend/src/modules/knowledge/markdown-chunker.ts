import {
  ChunkMetadata,
  KNOWLEDGE_CONSTANTS,
  KnowledgeSourceType,
} from './knowledge.constants';

export interface ParsedFrontmatter {
  title: string;
  source_type: string;
  area_slug?: string;
  category_tags: string[];
  sources?: string[];
  last_updated?: string;
  language?: string;
}

export interface ParsedMarkdownDoc {
  frontmatter: ParsedFrontmatter;
  body: string;
}

export interface SemanticChunk {
  content: string;
  metadata: ChunkMetadata;
}

/**
 * Pure function: Parses YAML Frontmatter and body from raw markdown string.
 * Zero external dependencies (Ponytail Rung 1-3).
 */
export function parseFrontmatter(raw: string): ParsedMarkdownDoc {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {
        title: 'Cẩm nang du lịch',
        source_type: KnowledgeSourceType.CURATED_GUIDE,
        category_tags: [],
        language: KNOWLEDGE_CONSTANTS.DEFAULT_LANGUAGE,
      },
      body: raw,
    };
  }

  const [, yamlBlock, body] = match;
  const fm: any = { category_tags: [] };

  const lines = yamlBlock.split(/\r?\n/);
  let currentKey = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && inList && currentKey) {
      const item = trimmed.slice(2).replace(/^["']|["']$/g, '').trim();
      if (!Array.isArray(fm[currentKey])) {
        fm[currentKey] = [];
      }
      fm[currentKey].push(item);
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();

      if (val === '') {
        currentKey = key;
        inList = true;
        fm[key] = [];
      } else if (val.startsWith('[') && val.endsWith(']')) {
        currentKey = key;
        inList = false;
        fm[key] = val
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      } else {
        currentKey = key;
        inList = false;
        fm[key] = val.replace(/^["']|["']$/g, '');
      }
    }
  }

  return { frontmatter: fm, body };
}

/**
 * Pure function: Splits markdown body by Heading 2 (##) and Heading 3 (###).
 * Injects hierarchical Breadcrumbs so every chunk is context-aware.
 */
export function createSemanticChunks(
  docTitle: string,
  body: string,
  context: { categoryTags: string[]; areaSlug?: string },
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  const lines = body.split(/\r?\n/);

  let currentH2 = '';
  let currentH3 = '';
  let currentLines: string[] = [];

  const flushChunk = () => {
    const text = currentLines.join('\n').trim();
    if (!text || text.length < KNOWLEDGE_CONSTANTS.MIN_CHUNK_CHAR_LENGTH) {
      currentLines = [];
      return;
    }

    const breadcrumbParts = [docTitle];
    if (currentH2) breadcrumbParts.push(currentH2);
    if (currentH3 && currentH3 !== currentH2) breadcrumbParts.push(currentH3);

    const breadcrumbs = breadcrumbParts.join(' > ');
    const sectionTitle = currentH3 || currentH2 || docTitle;

    // Injected Breadcrumb at the very top of each chunk
    const fullChunkText = `[Ngữ cảnh: ${breadcrumbs}]\n\n${text}`;

    chunks.push({
      content: fullChunkText,
      metadata: {
        sectionTitle,
        h2Title: currentH2 || undefined,
        h3Title: currentH3 || undefined,
        breadcrumbs,
        categoryTags: context.categoryTags,
        areaSlug: context.areaSlug,
      },
    });

    currentLines = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushChunk();
      currentH2 = line.replace(/^##\s+/, '').trim();
      currentH3 = '';
      currentLines.push(line);
    } else if (line.startsWith('### ')) {
      flushChunk();
      currentH3 = line.replace(/^###\s+/, '').trim();
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  flushChunk();
  return chunks;
}
