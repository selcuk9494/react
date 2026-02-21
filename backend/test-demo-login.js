
require('dotenv').config({ path: 'backend/.env' });
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');
const { AuthService } = require('./dist/src/auth/auth.service');
const { StockService } = require('./dist/src/stock/stock.service');

async function testDemoLogin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  const stockService = app.get(StockService);
  
  try {
    console.log('Testing Demo Login...');
    const result = await authService.loginDemo();
    console.log('User found/created:', result.user.email);
    
    if (result.user.branches && result.user.branches.length > 0) {
        const branch = result.user.branches[0];
        console.log('✅ Branch found:', branch.name);
        
        console.log(`Getting products for branchId: ${branch.id}`);
        const products = await stockService.getProducts(String(branch.id));
        console.log(`Found ${products.length} products.`);
        
        if (products.length > 0) {
            console.log('Sample product:', products[0]);
        } else {
            console.log('❌ Products list is empty!');
        }

        // Test stock entry with a sample item
        console.log('Testing stock entry...');
        try {
          const sampleName = (products[0] && (products[0].urun_adi || products[0].product_name)) || 'Hamburger';
          const res = await stockService.entryStock(String(branch.id), [
            { productName: sampleName, quantity: 5 },
          ]);
          console.log('✅ Stock entry result:', res);
        } catch (e) {
          console.error('❌ Stock entry error:', e.message || e);
        }
    } else {
        console.log('❌ No branches found for demo user!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

testDemoLogin();
