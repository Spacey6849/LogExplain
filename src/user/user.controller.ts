import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    Headers,
    UnauthorizedException,
    BadRequestException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiHeader,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateApiKeyDto, UpdateProfileDto } from './user.dto';

/**
 * User endpoints — protected via Supabase JWT (Authorization: Bearer <token>).
 * These endpoints let authenticated users manage their profile, API keys, and usage.
 */
@ApiTags('User')
@Controller({ path: 'user', version: '1' })
export class UserController {
    constructor(private readonly supabase: SupabaseService) { }

    // ────────────────────────────────────────────────────
    // Auth helper — extract & verify JWT from Authorization header
    // ────────────────────────────────────────────────────

    private async authenticate(
        authorization: string | undefined,
    ): Promise<{ userId: string; email: string }> {
        if (!authorization || !authorization.startsWith('Bearer ')) {
            throw new UnauthorizedException({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Use: Bearer <supabase_jwt>',
            });
        }

        if (!this.supabase.isConfigured()) {
            throw new BadRequestException({
                statusCode: 400,
                error: 'Not Configured',
                message: 'Supabase is not configured on this server',
            });
        }

        const token = authorization.replace('Bearer ', '');
        const client = this.supabase.getClient();

        const {
            data: { user },
            error,
        } = await client.auth.getUser(token);

        if (error || !user) {
            throw new UnauthorizedException({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Invalid or expired token',
            });
        }

        return { userId: user.id, email: user.email || '' };
    }

    // ────────────────────────────────────────────────────
    // Profile
    // ────────────────────────────────────────────────────

    @Get('profile')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiHeader({ name: 'Authorization', description: 'Bearer <supabase_jwt>' })
    @ApiResponse({ status: 200, description: 'User profile' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getProfile(@Headers('authorization') auth: string) {
        const { userId, email } = await this.authenticate(auth);
        const profile = await this.supabase.getOrCreateProfile(userId, email);
        return { data: profile };
    }

    @Patch('profile')
    @ApiOperation({ summary: 'Update current user profile' })
    @ApiHeader({ name: 'Authorization', description: 'Bearer <supabase_jwt>' })
    @ApiResponse({ status: 200, description: 'Updated profile' })
    async updateProfile(
        @Headers('authorization') auth: string,
        @Body() body: UpdateProfileDto,
    ) {
        const { userId } = await this.authenticate(auth);
        const profile = await this.supabase.updateProfile(userId, body);
        return { data: profile };
    }

    // ────────────────────────────────────────────────────
    // API Keys
    // ────────────────────────────────────────────────────

    @Get('api-keys')
    @ApiOperation({ summary: 'List all API keys for the current user' })
    @ApiHeader({ name: 'Authorization', description: 'Bearer <supabase_jwt>' })
    @ApiResponse({ status: 200, description: 'List of API keys (keys are masked)' })
    async listApiKeys(@Headers('authorization') auth: string) {
        const { userId } = await this.authenticate(auth);
        const keys = await this.supabase.listApiKeys(userId);
        return { data: keys };
    }

    @Post('api-keys')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Generate a new API key',
        description:
            'Creates a new API key. The raw key is returned ONLY in this response — store it securely. It cannot be retrieved later.',
    })
    @ApiHeader({ name: 'Authorization', description: 'Bearer <supabase_jwt>' })
    @ApiResponse({ status: 201, description: 'New API key created' })
    async createApiKey(
        @Headers('authorization') auth: string,
        @Body() body: CreateApiKeyDto,
    ) {
        const { userId } = await this.authenticate(auth);

        // Limit to 10 keys per user
        const existing = await this.supabase.listApiKeys(userId);
        if (existing.length >= 10) {
            throw new BadRequestException({
                statusCode: 400,
                error: 'Limit Reached',
                message: 'Maximum of 10 API keys per user. Please revoke an existing key first.',
            });
        }

        const result = await this.supabase.createApiKey(userId, body.name);
        return {
            data: {
                id: result.keyId,
                key: result.key,
                prefix: result.prefix,
                name: body.name,
            },
            warning:
                'Store this key securely — it will NOT be shown again.',
        };
    }

    @Delete('api-keys/:keyId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Revoke (deactivate) an API key' })
    @ApiHeader({ name: 'Authorization', description: 'Bearer <supabase_jwt>' })
    @ApiParam({ name: 'keyId', description: 'API key UUID to revoke' })
    @ApiResponse({ status: 200, description: 'Key revoked' })
    async revokeApiKey(
        @Headers('authorization') auth: string,
        @Param('keyId') keyId: string,
    ) {
        const { userId } = await this.authenticate(auth);
        const success = await this.supabase.revokeApiKey(userId, keyId);

        if (!success) {
            throw new BadRequestException({
                statusCode: 400,
                error: 'Failed',
                message: 'Could not revoke API key. It may not exist or belong to you.',
            });
        }

        return { message: 'API key revoked successfully' };
    }

    @Delete('api-keys/:keyId/permanent')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Permanently delete an API key' })
    @ApiHeader({ name: 'Authorization', description: 'Bearer <supabase_jwt>' })
    @ApiParam({ name: 'keyId', description: 'API key UUID to permanently delete' })
    @ApiResponse({ status: 200, description: 'Key deleted permanently' })
    async deleteApiKey(
        @Headers('authorization') auth: string,
        @Param('keyId') keyId: string,
    ) {
        const { userId } = await this.authenticate(auth);
        const success = await this.supabase.deleteApiKey(userId, keyId);

        if (!success) {
            throw new BadRequestException({
                statusCode: 400,
                error: 'Failed',
                message: 'Could not delete API key. It may not exist or belong to you.',
            });
        }

        return { message: 'API key permanently deleted' };
    }

    // ────────────────────────────────────────────────────
    // Usage Analytics
    // ────────────────────────────────────────────────────

    @Get('usage')
    @ApiOperation({ summary: 'Get API usage statistics for the current user' })
    @ApiHeader({ name: 'Authorization', description: 'Bearer <supabase_jwt>' })
    @ApiQuery({
        name: 'days',
        required: false,
        description: 'Number of days to look back (default: 30, max: 90)',
        example: 30,
    })
    @ApiResponse({ status: 200, description: 'Usage statistics' })
    async getUsage(
        @Headers('authorization') auth: string,
        @Query('days') days?: string,
    ) {
        const { userId } = await this.authenticate(auth);
        const numDays = Math.min(parseInt(days || '30', 10) || 30, 90);
        const stats = await this.supabase.getUsageStats(userId, numDays);

        return { data: stats, period: `${numDays} days` };
    }
}
