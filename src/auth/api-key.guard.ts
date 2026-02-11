import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Extended Request interface to carry API key context through the request lifecycle.
 * The usage interceptor reads these to log per-key metrics.
 */
export interface AuthenticatedRequest extends Request {
  apiKeyId?: string;
  apiKeyUserId?: string;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly envKeys: Set<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    // Fallback: env-based keys still work when Supabase is not configured
    const raw = this.config.get<string>('API_KEYS') || '';
    this.envKeys = new Set(
      raw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing x-api-key header',
      });
    }

    // ── Strategy 1: Supabase-backed keys ────────────────────
    if (this.supabase.isConfigured()) {
      const result = await this.supabase.validateApiKey(apiKey);
      if (result.valid) {
        // Attach key metadata to request for the usage interceptor
        request.apiKeyId = result.keyId;
        request.apiKeyUserId = result.userId;
        return true;
      }
    }

    // ── Strategy 2: Env-based keys (fallback / dev mode) ────
    if (this.envKeys.has(apiKey)) {
      return true;
    }

    throw new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }
}
