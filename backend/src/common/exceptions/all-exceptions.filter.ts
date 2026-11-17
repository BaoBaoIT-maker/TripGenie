import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../constants/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Hệ thống đang bận hoặc gặp sự cố tạm thời. Vui lòng thử lại sau.';
    let errors: any = null;
    let code: string = ERROR_CODES.INTERNAL_SERVER_ERROR;
    let devError: string | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.mapStatusToErrorCode(status);
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, any>;
        code = responseObj.code;

        // NestJS ValidationPipe / class-validator error array
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message[0] || 'Dữ liệu không hợp lệ';
          errors = responseObj.message;
          code = code || ERROR_CODES.VALIDATION_FAILED;
        } else {
          message = responseObj.message || exception.message || 'Yêu cầu không hợp lệ';
          errors = responseObj.errors || null;
          code = code || this.mapStatusToErrorCode(status);
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const handled = this.handlePrismaKnownError(exception);
      status = handled.status;
      code = handled.code;
      message = handled.message;
      errors = handled.errors ?? null;
      devError = exception.message;
      this.logger.warn(
        `Prisma Known Error [${exception.code}] on ${request.method} ${request.url}: ${exception.message}`,
      );
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = ERROR_CODES.VALIDATION_FAILED;
      message = 'Dữ liệu truy vấn cơ sở dữ liệu không hợp lệ.';
      devError = exception.message;
      this.logger.warn(
        `Prisma Validation Error on ${request.method} ${request.url}: ${exception.message}`,
      );
    } else if (
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      (exception instanceof Error && this.isDatabaseConstraintViolation(exception.message))
    ) {
      status = HttpStatus.BAD_REQUEST;
      code = ERROR_CODES.DATABASE_ERROR;
      message = 'Yêu cầu không thể thực hiện do vi phạm ràng buộc dữ liệu.';
      devError = (exception as Error).message;
      this.logger.error(
        `Database Constraint Error on ${request.method} ${request.url}: ${(exception as Error).message}`,
        (exception as Error).stack,
      );
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ERROR_CODES.INTERNAL_SERVER_ERROR;
      // ALWAYS keep user message clean and safe against information leakage.
      message = 'Hệ thống đang bận hoặc gặp sự cố tạm thời. Vui lòng thử lại sau.';
      devError = exception.message;
      this.logger.error(
        `Unhandled Exception [${exception.name}] on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    const payload: Record<string, unknown> = {
      statusCode: status,
      success: false,
      code,
      message: Array.isArray(message) ? message[0] : message,
      errors: errors ?? null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (process.env.NODE_ENV === 'development' && devError) {
      payload.devError = devError;
    }

    response.status(status).json(payload);
  }

  private isDatabaseConstraintViolation(errorMessage?: string): boolean {
    if (!errorMessage) return false;
    return (
      errorMessage.includes('violates check constraint') ||
      errorMessage.includes('violates foreign key constraint') ||
      errorMessage.includes('violates unique constraint') ||
      errorMessage.includes('violates not-null constraint') ||
      errorMessage.includes('Database error. Code: 23514') ||
      errorMessage.includes('Database error. Code: 23505') ||
      errorMessage.includes('Database error. Code: 23503')
    );
  }

  private handlePrismaKnownError(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    errors?: unknown;
  } {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[])?.join(', ');
        return {
          status: HttpStatus.CONFLICT,
          code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
          message: target
            ? `Dữ liệu trường (${target}) đã tồn tại trên hệ thống.`
            : 'Dữ liệu đã tồn tại trên hệ thống (trùng lặp).',
          errors: err.meta,
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'Không tìm thấy dữ liệu yêu cầu.',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ERROR_CODES.BAD_REQUEST,
          message: 'Dữ liệu liên kết không hợp lệ hoặc không tồn tại.',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'Yêu cầu không thể thực hiện do vi phạm ràng buộc dữ liệu.',
        };
    }
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_EXCEEDED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ERROR_CODES.SERVICE_UNAVAILABLE;
      default:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
  }
}
