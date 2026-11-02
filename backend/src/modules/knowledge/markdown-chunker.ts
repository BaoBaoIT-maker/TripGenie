import { KNOWLEDGE_CONSTANTS } from './knowledge.constants';

const DEFAULT_DOC_TITLE = 'Cẩm nang du lịch';

export interface ParsedFrontmatter {
  title: string;
  area_slug?: string;
}

export interface ParsedMarkdownDoc {
  frontmatter: ParsedFrontmatter;
  body: string;
}

export interface SemanticChunk {
  content: string;
  breadcrumbs: string;
}

/** Reads one top-level scalar (`key: "value"`) from a YAML block. Other keys (lists, notes) are ignored. */
function readYamlScalar(yamlBlock: string, key: string): string | undefined {
  const match = yamlBlock.match(new RegExp(`^${key}:\\s*["']?(.*?)["']?\\s*$`, 'm'));
  return match?.[1] || undefined;
}

/**
 * Pure function: splits YAML Frontmatter and body from a raw markdown string.
 * Only `title` and `area_slug` are consumed by the RAG pipeline; any other key is authoring notes.
 */
export function parseFrontmatter(raw: string): ParsedMarkdownDoc {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: { title: DEFAULT_DOC_TITLE }, body: raw };
  }

  const [, yamlBlock, body] = match;
  return {
    frontmatter: {
      title: readYamlScalar(yamlBlock, 'title') ?? DEFAULT_DOC_TITLE,
      area_slug: readYamlScalar(yamlBlock, 'area_slug'),
    },
    body,
  };
}

/**
 * Pure function: splits markdown body by Heading 2 (##) and Heading 3 (###).
 * Injects hierarchical Breadcrumbs so every chunk is context-aware.
 */
export function createSemanticChunks(docTitle: string, body: string): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  const lines = body.split(/\r?\n/);

  let currentH2 = '';
  let currentH3 = '';
  let currentLines: string[] = [];

  const flushChunk = () => {
    const text = currentLines.join('\n').trim();
    currentLines = [];
    if (!text || text.length < KNOWLEDGE_CONSTANTS.MIN_CHUNK_CHAR_LENGTH) return;

    const breadcrumbParts = [docTitle];
    if (currentH2) breadcrumbParts.push(currentH2);
    if (currentH3 && currentH3 !== currentH2) breadcrumbParts.push(currentH3);
    const breadcrumbs = breadcrumbParts.join(' > ');

    // Injected Breadcrumb at the very top of each chunk (also embedded into the vector)
    chunks.push({ content: `[Ngữ cảnh: ${breadcrumbs}]\n\n${text}`, breadcrumbs });
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushChunk();
      currentH2 = line.replace(/^##\s+/, '').trim();
      currentH3 = '';
    } else if (line.startsWith('### ')) {
      flushChunk();
      currentH3 = line.replace(/^###\s+/, '').trim();
    }
    currentLines.push(line);
  }

  flushChunk();
  return chunks;
}
