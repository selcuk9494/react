
require('dotenv').config({ path: 'backend/.env' });
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');
const { AuthService } = require('./dist/src/auth/auth.service');

async function testValidateUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  
  try {
    console.log('Testing Validate User...');
    const email = 'demo@micrapor.com';
    const pass = 'demo';
    
    console.log(`Validating ${email} / ${pass}`);
    const result = await authService.validateUser(email, pass);
    
    console.log('Result:', result);
    
    if (result && result !== 'not_found' && result !== 'wrong_password' && result !== 'expired') {
        console.log('✅ Validation successful!');
        const token = await authService.login(result);
        console.log('Token generated:', token.access_token ? 'Yes' : 'No');
    } else {
        console.log('❌ Validation failed:', result);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

testValidateUser();
