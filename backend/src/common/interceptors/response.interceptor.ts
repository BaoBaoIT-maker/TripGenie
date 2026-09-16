import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../types';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // If data is already structured with message/data fields
        if (data && typeof data === 'object' && 'data' in data && 'message' in data) {
          return {
            statusCode: response.statusCode,
            success: true,
            message: data.message,
            data: data.data,
            meta: data.meta,
          };
        }

        return {
          statusCode: response.statusCode,
          success: true,
          message: 'Thành công',
          data: data !== undefined ? data : null,
        };
      }),
    );
  }
}
