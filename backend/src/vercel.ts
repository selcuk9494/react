import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import express from 'express';

const expressApp = express();
const adapter = new ExpressAdapter(expressApp);
let app: any;

const bootstrap = async () => {
  if (!app) {
    app = await NestFactory.create(AppModule, adapter);
    app.enableCors();
    await app.init();
  }
  return app;
};

export default async (req: any, res: any) => {
  if (!app) {
    await bootstrap();
  }
  expressApp(req, res);
};
