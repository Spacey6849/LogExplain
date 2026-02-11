import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
    private client: SupabaseClient;
    private readonly logger = new Logger(SupabaseService.name);

    constructor(private readonly config: ConfigService) { }

    onModuleInit() {
        const url = this.config.get<string>('SUPABASE_URL');
        const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        if (!url || !serviceKey) {
            this.logger.warn(
                'Supabase not configured — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing. ' +
                'Falling back to env-based API key validation.',
            );
            return;
        }

        this.client = createClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        this.logger.log('Supabase client initialized');
    }

    /** Check if Supabase is configured and available */
    isConfigured(): boolean {
        return !!this.client;
    }

    /** Get the raw Supabase client (service role — full access) */
    getClient(): SupabaseClient {
        return this.client;
    }

    // ────────────────────────────────────────────────────
    // API Key Operations
    // ────────────────────────────────────────────────────

    /** Validate an API key and return its record if valid */
    async validateApiKey(apiKey: string): Promise<{
        valid: boolean;
        keyId?: string;
        userId?: string;
    }> {
        if (!this.client) return { valid: false };

        // We store SHA-256 hash of the key for security
        const keyHash = await this.hashKey(apiKey);

        const { data, error } = await this.client
            .from('api_keys')
            .select('id, user_id, is_active, expires_at')
            .eq('key_hash', keyHash)
            .eq('is_active', true)
            .single();

        if (error || !data) return { valid: false };

        // Check expiration
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
            return { valid: false };
        }

        // Update last_used_at
        await this.client
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', data.id);

        return { valid: true, keyId: data.id, userId: data.user_id };
    }

    /** Create a new API key for a user */
    async createApiKey(userId: string, name: string): Promise<{
        key: string;
        keyId: string;
        prefix: string;
    }> {
        const { randomBytes } = await import('crypto');
        const rawKey = `le_${randomBytes(32).toString('hex')}`;
        const prefix = rawKey.substring(0, 11); // "le_" + 8 hex chars
        const keyHash = await this.hashKey(rawKey);

        const { data, error } = await this.client
            .from('api_keys')
            .insert({
                user_id: userId,
                key_hash: keyHash,
                key_prefix: prefix,
                name: name || 'Default Key',
                is_active: true,
            })
            .select('id')
            .single();

        if (error) throw new Error(`Failed to create API key: ${error.message}`);

        return { key: rawKey, keyId: data.id, prefix };
    }

    /** List all API keys for a user (never returns the actual key) */
    async listApiKeys(userId: string) {
        const { data, error } = await this.client
            .from('api_keys')
            .select('id, key_prefix, name, is_active, created_at, last_used_at, expires_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to list keys: ${error.message}`);
        return data || [];
    }

    /** Revoke (deactivate) an API key */
    async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
        const { error } = await this.client
            .from('api_keys')
            .update({ is_active: false })
            .eq('id', keyId)
            .eq('user_id', userId);

        return !error;
    }

    /** Delete an API key permanently */
    async deleteApiKey(userId: string, keyId: string): Promise<boolean> {
        const { error } = await this.client
            .from('api_keys')
            .delete()
            .eq('id', keyId)
            .eq('user_id', userId);

        return !error;
    }

    // ────────────────────────────────────────────────────
    // Usage Tracking
    // ────────────────────────────────────────────────────

    /** Record an API usage event */
    async recordUsage(params: {
        apiKeyId: string;
        endpoint: string;
        statusCode: number;
        responseTimeMs: number;
    }) {
        if (!this.client) return;

        await this.client.from('api_usage').insert({
            api_key_id: params.apiKeyId,
            endpoint: params.endpoint,
            status_code: params.statusCode,
            response_time_ms: params.responseTimeMs,
        });
    }

    /** Get usage stats for a user */
    async getUsageStats(userId: string, days = 30) {
        if (!this.client) return null;

        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get all key IDs for this user
        const { data: keys } = await this.client
            .from('api_keys')
            .select('id')
            .eq('user_id', userId);

        if (!keys || keys.length === 0) {
            return {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                avgResponseTimeMs: 0,
                requestsByDay: [],
                requestsByEndpoint: [],
            };
        }

        const keyIds = keys.map((k) => k.id);

        // Get usage data
        const { data: usage } = await this.client
            .from('api_usage')
            .select('*')
            .in('api_key_id', keyIds)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false });

        if (!usage || usage.length === 0) {
            return {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                avgResponseTimeMs: 0,
                requestsByDay: [],
                requestsByEndpoint: [],
            };
        }

        // Aggregate stats
        const totalRequests = usage.length;
        const successfulRequests = usage.filter((u) => u.status_code >= 200 && u.status_code < 400).length;
        const failedRequests = totalRequests - successfulRequests;
        const avgResponseTimeMs = Math.round(
            usage.reduce((sum, u) => sum + (u.response_time_ms || 0), 0) / totalRequests,
        );

        // Group by day
        const byDay = new Map<string, number>();
        for (const u of usage) {
            const day = u.created_at.substring(0, 10);
            byDay.set(day, (byDay.get(day) || 0) + 1);
        }
        const requestsByDay = Array.from(byDay.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Group by endpoint
        const byEndpoint = new Map<string, number>();
        for (const u of usage) {
            byEndpoint.set(u.endpoint, (byEndpoint.get(u.endpoint) || 0) + 1);
        }
        const requestsByEndpoint = Array.from(byEndpoint.entries())
            .map(([endpoint, count]) => ({ endpoint, count }))
            .sort((a, b) => b.count - a.count);

        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            avgResponseTimeMs,
            requestsByDay,
            requestsByEndpoint,
        };
    }

    // ────────────────────────────────────────────────────
    // User Profile
    // ────────────────────────────────────────────────────

    /** Get or create a user profile */
    async getOrCreateProfile(userId: string, email?: string) {
        if (!this.client) return null;

        const { data: existing } = await this.client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (existing) return existing;

        // Create new profile
        const { data: newProfile, error } = await this.client
            .from('profiles')
            .insert({
                id: userId,
                email: email || '',
                full_name: '',
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create profile: ${error.message}`);
        return newProfile;
    }

    /** Update user profile */
    async updateProfile(userId: string, updates: { full_name?: string }) {
        const { data, error } = await this.client
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update profile: ${error.message}`);
        return data;
    }

    // ────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────

    private async hashKey(key: string): Promise<string> {
        const { createHash } = await import('crypto');
        return createHash('sha256').update(key).digest('hex');
    }
}
