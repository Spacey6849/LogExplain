import { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/main';

// Cache the NestJS application instance for warm starts
let app;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!app) {
        app = await createApp();
        await app.init();
    }

    const expressApp = app.getHttpAdapter().getInstance();
    return expressApp(req, res);
}
