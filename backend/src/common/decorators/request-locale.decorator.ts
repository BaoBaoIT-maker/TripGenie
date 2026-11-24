import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppLocale, parseLocale } from '../i18n/locale.util';

/**
 * Extracts and normalizes the active request locale (`vi` | `en`)
 * from the HTTP `Accept-Language` header.
 */
export const RequestLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppLocale => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return parseLocale(request?.headers?.['accept-language']);
  },
);
