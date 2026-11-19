import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  AuditAction,
  BannedWord,
  BannedWordCategory,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { AuthenticatedUser } from '@/common/types';
import { AdminService } from './admin.service';
import { ADMIN_CONSTANTS, ADMIN_ERRORS } from './admin.constants';
import { AdminRequestMeta } from './dto/admin-users.dto';
import {
  CreateBannedWordDto,
  QueryBannedWordsDto,
} from './dto/admin-banned-words.dto';

export interface BannedWordCheckResult {
  isBanned: boolean;
  matchedWord?: string;
  category?: BannedWordCategory;
}

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
// Strips separators injected between letters to dodge filters ("đ.ụ", "l-ồ-n", "n*ắ*c").
const LETTER_SEPARATOR_EVASION = /(\p{L})[._*~-]+(?=\p{L})/gu;
// Unicode-aware word boundary: a banned word never matches inside a longer word.
const WORD_START = '(?<![\\p{L}\\p{N}])';
const WORD_END = '(?![\\p{L}\\p{N}])';

/**
 * Admin-managed banned words. Postgres is the source of truth; matching runs
 * entirely in RAM (one compiled regex) so the request path makes no DB call.
 */
@Injectable()
export class BannedWordsService implements OnModuleInit {
  private readonly logger = new Logger(BannedWordsService.name);
  private categoryByWord = new Map<string, BannedWordCategory>();
  private compiledRegex: RegExp | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  async onModuleInit() {
    await this.reloadCache();
  }

  // ponytail: cache is per-process; with multiple backend instances an edit only reloads the instance that served it. Upgrade path: Redis pub/sub "banned-words:changed" -> reloadCache().
  async reloadCache(): Promise<void> {
    try {
      const activeWords = await this.prisma.bannedWord.findMany({
        where: { isActive: true },
        select: { word: true, category: true },
      });

      const nextMap = new Map<string, BannedWordCategory>();
      for (const { word, category } of activeWords) {
        nextMap.set(this.normalizeForScan(word), category);
      }

      this.categoryByWord = nextMap;
      this.compiledRegex = this.compile([...nextMap.keys()]);
      this.logger.log(`Banned words cache reloaded: ${nextMap.size} active words.`);
    } catch (err) {
      // Keep serving the previous cache rather than dropping protection.
      this.logger.error(
        `Failed to reload banned words cache: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private compile(words: string[]): RegExp | null {
    if (words.length === 0) return null;
    // Longest first so "chó đẻ" wins over a shorter overlapping entry.
    const alternation = [...words]
      .sort((a, b) => b.length - a.length)
      .map((w) => w.replace(REGEX_SPECIAL_CHARS, '\\$&'))
      .join('|');
    return new RegExp(`${WORD_START}(?:${alternation})${WORD_END}`, 'iu');
  }

  normalizeForScan(text: string): string {
    return text
      .toLowerCase()
      .replace(LETTER_SEPARATOR_EVASION, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  checkBannedSync(text: string): BannedWordCheckResult {
    if (!text || !this.compiledRegex) return { isBanned: false };

    const match = this.compiledRegex.exec(this.normalizeForScan(text));
    if (!match) return { isBanned: false };

    const matchedWord = match[0].toLowerCase();
    return {
      isBanned: true,
      matchedWord,
      category: this.categoryByWord.get(matchedWord),
    };
  }

  async findAll(query: QueryBannedWordsDto) {
    const { page, limit, skip } = this.adminService.resolvePagination(query);

    const search = query.search?.trim();
    const where: Prisma.BannedWordWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(search
        ? {
            OR: [
              { word: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.bannedWord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, fullName: true, username: true } },
        },
      }),
      this.prisma.bannedWord.count({ where }),
    ]);

    return this.adminService.buildPaginatedResponse(items, total, page, limit);
  }

  async create(
    admin: AuthenticatedUser,
    dto: CreateBannedWordDto,
    meta?: AdminRequestMeta,
  ): Promise<BannedWord> {
    const word = this.normalizeForScan(dto.word);

    const existing = await this.prisma.bannedWord.findUnique({
      where: { word },
    });
    if (existing) {
      throw new ConflictException(ADMIN_ERRORS.BANNED_WORD_EXISTS);
    }

    const created = await this.prisma.bannedWord.create({
      data: {
        word,
        category: dto.category,
        notes: dto.notes?.trim() || null,
        createdBy: admin.id,
      },
    });

    await this.audit(admin, AuditAction.CREATE, created, meta, {
      before: null,
      after: created,
      note: ADMIN_CONSTANTS.MESSAGES.DEFAULT_CREATE_BANNED_WORD_NOTE,
    });
    await this.reloadCache();
    return created;
  }

  async toggleActive(
    admin: AuthenticatedUser,
    id: string,
    isActive: boolean,
    meta?: AdminRequestMeta,
  ): Promise<BannedWord> {
    const existing = await this.findOrThrow(id);
    const updated = await this.prisma.bannedWord.update({
      where: { id },
      data: { isActive },
    });

    await this.audit(admin, AuditAction.UPDATE, updated, meta, {
      before: { isActive: existing.isActive },
      after: { isActive: updated.isActive },
      note: isActive
        ? ADMIN_CONSTANTS.MESSAGES.DEFAULT_ENABLE_BANNED_WORD_NOTE
        : ADMIN_CONSTANTS.MESSAGES.DEFAULT_DISABLE_BANNED_WORD_NOTE,
    });
    await this.reloadCache();
    return updated;
  }

  async delete(
    admin: AuthenticatedUser,
    id: string,
    meta?: AdminRequestMeta,
  ): Promise<{ success: boolean; message: string; id: string }> {
    const existing = await this.findOrThrow(id);
    await this.prisma.bannedWord.delete({ where: { id } });

    await this.audit(admin, AuditAction.DELETE, existing, meta, {
      before: existing,
      after: null,
      note: ADMIN_CONSTANTS.MESSAGES.DEFAULT_DELETE_BANNED_WORD_NOTE,
    });
    await this.reloadCache();
    return {
      success: true,
      message: ADMIN_CONSTANTS.MESSAGES.DELETE_BANNED_WORD_SUCCESS,
      id,
    };
  }

  private async findOrThrow(id: string): Promise<BannedWord> {
    const existing = await this.prisma.bannedWord.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(ADMIN_ERRORS.BANNED_WORD_NOT_FOUND);
    }
    return existing;
  }

  private audit(
    admin: AuthenticatedUser,
    action: AuditAction,
    target: BannedWord,
    meta: AdminRequestMeta | undefined,
    diff: { before: unknown; after: unknown; note: string },
  ) {
    return this.adminService.logAudit({
      actorId: admin.id,
      actorRole: admin.role,
      action,
      targetType: ADMIN_CONSTANTS.AUDIT_TARGET_TYPES.BANNED_WORD,
      targetId: target.id,
      targetLabel: target.word,
      beforeData: diff.before as Prisma.InputJsonValue,
      afterData: diff.after as Prisma.InputJsonValue,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      notes: diff.note,
    });
  }
}
