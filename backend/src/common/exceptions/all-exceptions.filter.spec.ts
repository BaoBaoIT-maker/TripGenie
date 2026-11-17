import { HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ERROR_CODES } from '../constants/error-codes';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: {
    url: string;
    method: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/v1/test',
      method: 'GET',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle standard HttpException with fallback error code', () => {
    const exception = new NotFoundException('Không tìm thấy tài nguyên');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        success: false,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Không tìm thấy tài nguyên',
        path: '/api/v1/test',
      }),
    );
  });

  it('should handle class-validator validation array error with VALIDATION_FAILED code', () => {
    const exception = new BadRequestException([
      'email must be an email',
      'password is too short',
    ]);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        success: false,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'email must be an email',
        errors: ['email must be an email', 'password is too short'],
      }),
    );
  });

  it('should map Prisma P2002 unique constraint error to 409 Conflict', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['email'] },
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        success: false,
        code: ERROR_CODES.RESOURCE_ALREADY_EXISTS,
        message: 'Dữ liệu trường (email) đã tồn tại trên hệ thống.',
      }),
    );
  });

  it('should detect raw database constraint errors and map to 400 Bad Request with DATABASE_ERROR code', () => {
    const dbConstraintError = new Error('Database error. Code: 23514. Relation audit_logs violates check constraint chk_audit_target_type');

    filter.catch(dbConstraintError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        success: false,
        code: ERROR_CODES.DATABASE_ERROR,
        message: 'Yêu cầu không thể thực hiện do vi phạm ràng buộc dữ liệu.',
      }),
    );
  });

  it('should sanitize unhandled runtime Error and NEVER leak internal stack trace in user-facing message', () => {
    const rawError = new Error('Unexpected internal failure in crypto/hash');

    filter.catch(rawError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Hệ thống đang bận hoặc gặp sự cố tạm thời. Vui lòng thử lại sau.',
        path: '/api/v1/test',
      }),
    );
  });
});
