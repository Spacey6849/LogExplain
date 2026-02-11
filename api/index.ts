import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VercelRequest, VercelResponse } from '@vercel/node';

let cachedServer: any;

async function bootstrapServer() {
    console.log('Bootstrapping server...');
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn'],
    });

    app.enableCors({ origin: '*' });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    app.setGlobalPrefix('v1');

    // Generate OpenAPI spec and serve as JSON only (no Swagger UI from server)
    const swaggerConfig = new DocumentBuilder()
        .setTitle('LogExplain API')
        .setDescription('Human-Readable Log Interpretation API — converts raw system logs into structured explanations, root-cause analysis, severity classification, and recommended actions.')
        .setVersion('1.0.0')
        .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
        .addTag('logs', 'Log interpretation endpoints')
        .addTag('health', 'Health check endpoint')
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    // Serve the OpenAPI JSON spec at /api-spec (static Swagger UI will fetch this)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/api-spec', (_req: any, res: any) => {
        res.json(document);
    });

    await app.init();
    console.log('Server bootstrapped successfully');
    return expressApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!cachedServer) {
        try {
            cachedServer = await bootstrapServer();
        } catch (error: any) {
            console.error('Bootstrap failed:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'Failed to start API',
                message: error.message,
                stack: error.stack
            }));
            return;
        }
    }

    return cachedServer(req, res);
}
