import 'reflect-metadata';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/main';

let cachedServer: any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!cachedServer) {
        console.log('Initializing LogExplain API (Cold Start)...');
        try {
            const app = await createApp();
            await app.init();
            cachedServer = app.getHttpAdapter().getInstance();
            console.log('App initialized successfully');
        } catch (err) {
            console.error('Failed to initialize app:', err);
            // Return 500 directly so we see it in the response, not just logs
            res.status(500).json({
                error: 'Internal Server Error during startup',
                details: err instanceof Error ? err.message : String(err)
            });
            return;
        }
    }

    // Handle the request
    return cachedServer(req, res);
}
