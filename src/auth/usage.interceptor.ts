import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthenticatedRequest } from './api-key.guard';

/**
 * Intercepts every API request and records usage metrics
 * (endpoint, status code, response time) to the api_usage table.
 * Only tracks requests that have a Supabase-backed API key attached.
 */
@Injectable()
export class UsageInterceptor implements NestInterceptor {
    constructor(private readonly supabase: SupabaseService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const startTime = Date.now();
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const response = context.switchToHttp().getResponse();

        return next.handle().pipe(
            tap({
                next: () => {
                    this.recordUsage(request, response.statusCode, startTime);
                },
                error: (err) => {
                    const statusCode = err?.status || err?.statusCode || 500;
                    this.recordUsage(request, statusCode, startTime);
                },
            }),
        );
    }

    private recordUsage(
        request: AuthenticatedRequest,
        statusCode: number,
        startTime: number,
    ) {
        // Only record if this request was authenticated via a Supabase key
        if (!request.apiKeyId || !this.supabase.isConfigured()) return;

        const responseTimeMs = Date.now() - startTime;
        const endpoint = `${request.method} ${request.route?.path || request.url}`;

        // Fire and forget — don't block the response
        this.supabase
            .recordUsage({
                apiKeyId: request.apiKeyId,
                endpoint,
                statusCode,
                responseTimeMs,
            })
            .catch(() => {
                /* silently ignore usage tracking errors */
            });
    }
}
