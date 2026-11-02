export interface GeminiPart {
  text?: string;
  thoughtSignature?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface ChatHistoryRowLike {
  sender: string;
  content: string | null;
}

/**
 * Builds a strictly alternating `user` <-> `model` Gemini contents array.
 * - Drops leading `model` messages (e.g. when a sliding window slices mid-turn).
 * - Merges consecutive turns of the same role (e.g. after an interrupted turn).
 */
export function buildAlternatingGeminiContents<T extends ChatHistoryRowLike>(
  history: T[],
  currentMessage: string,
  formatRowText?: (row: T) => string,
): GeminiContent[] {
  const contents: GeminiContent[] = [];

  const pushTurn = (role: 'user' | 'model', text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (contents.length === 0 && role === 'model') return;

    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) {
      prev.parts.push({ text: trimmed });
      return;
    }
    contents.push({ role, parts: [{ text: trimmed }] });
  };

  for (const row of history) {
    if (!row.content) continue;
    const role = row.sender === 'USER' ? 'user' : 'model';
    const text = formatRowText ? formatRowText(row) : row.content;
    pushTurn(role, text);
  }

  pushTurn('user', currentMessage);
  return contents;
}
