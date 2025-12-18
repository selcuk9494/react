import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend domains
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://react-kmfo.vercel.app',
      /\.vercel\.app$/,  // Allow all vercel.app subdomains
    ],
    credentials: true,
  });
  
  const port = process.env.PORT || 8001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend is running on http://0.0.0.0:${port}`);
}
bootstrap();
