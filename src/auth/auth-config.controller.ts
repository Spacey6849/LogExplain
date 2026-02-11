import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

/**
 * Public auth config endpoint — returns the Supabase URL and anon key
 * so that frontend pages can initialize the Supabase client.
 * The anon key is safe to expose; it's meant for client-side use.
 */
@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthConfigController {
    constructor(private readonly config: ConfigService) { }

    @Get('config')
    @ApiOperation({
        summary: 'Get Supabase client config',
        description:
            'Returns the Supabase URL and anon key for client-side authentication. ' +
            'The anon key is safe to expose publicly — it only allows authenticated operations with RLS.',
    })
    @ApiResponse({ status: 200, description: 'Supabase config returned' })
    getConfig() {
        return {
            supabaseUrl: this.config.get<string>('SUPABASE_URL') || '',
            supabaseAnonKey: this.config.get<string>('SUPABASE_ANON_KEY') || '',
            configured: !!(
                this.config.get<string>('SUPABASE_URL') &&
                this.config.get<string>('SUPABASE_ANON_KEY')
            ),
        };
    }
}
