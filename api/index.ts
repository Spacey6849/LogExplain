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

    // Basic Security
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

    // Re-enable Swagger
    const swaggerConfig = new DocumentBuilder()
        .setTitle('LogExplain API')
        .setDescription('Serverless Log Interpretation API')
        .setVersion('1.0')
        .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);

    await app.init();
    const instance = app.getHttpAdapter().getInstance();
    console.log('Server bootstrapped successfully');
    return instance;
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
