import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module'; // Import root module directly
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { VercelRequest, VercelResponse } from '@vercel/node';

// Cache app for performance
let cachedServer: any;

async function bootstrapServer() {
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'], // Reduce log noise in production
    });

    // Replicate main.ts setup exactly
    app.use(helmet());
    app.enableCors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    app.setGlobalPrefix('v1');

    // Initialize Swagger for Vercel (optional, but good for docs)
    const swaggerConfig = new DocumentBuilder()
        .setTitle('LogExplain API')
        .setDescription('Serverless Log API')
        .setVersion('1.0')
        .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);

    await app.init();
    return app.getHttpAdapter().getInstance();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!cachedServer) {
        try {
            cachedServer = await bootstrapServer();
        } catch (err: any) {
            console.error('Server Bootstrap Failed:', err);
            // Return JSON error response so you see it in browser
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                status: 'error',
                message: 'Failed to start API',
                detail: err.message,
                stack: err.stack
            }));
            return;
        }
    }

    return cachedServer(req, res);
}
