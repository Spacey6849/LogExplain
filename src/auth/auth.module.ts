import { Module, Global } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { UsageInterceptor } from './usage.interceptor';
import { AuthConfigController } from './auth-config.controller';

@Global()
@Module({
  controllers: [AuthConfigController],
  providers: [ApiKeyGuard, UsageInterceptor],
  exports: [ApiKeyGuard, UsageInterceptor],
})
export class AuthModule { }
