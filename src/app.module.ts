import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LogsModule } from './logs/logs.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UserModule } from './user/user.module';
import { UsageInterceptor } from './auth/usage.interceptor';

@Module({
  imports: [
    // ─── Environment config ─────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─── Rate limiting ──────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '60', 10),
      },
    ]),

    // ─── Feature modules ────────────────────────────
    SupabaseModule,
    AuthModule,
    LogsModule,
    HealthModule,
    UserModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UsageInterceptor,
    },
  ],
})
export class AppModule { }
