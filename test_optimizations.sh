#!/bin/bash

# Renk kodları
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}   Testing Optimizations${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Test PostgreSQL connection
echo -e "${YELLOW}🔍 Testing PostgreSQL connection...${NC}"
cd /app/backend

# Create a quick test script
cat > test_db.js << 'EOF'
const { Pool } = require('pg');

const pool = new Pool({
  host: '212.108.132.92',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'react',
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function testConnection() {
  try {
    const start = Date.now();
    const client = await pool.connect();
    const elapsed = Date.now() - start;
    
    console.log(`✅ Connected in ${elapsed}ms`);
    
    // Test query
    const queryStart = Date.now();
    const result = await client.query('SELECT COUNT(*) FROM users');
    const queryElapsed = Date.now() - queryStart;
    
    console.log(`✅ Query executed in ${queryElapsed}ms`);
    console.log(`📊 Users count: ${result.rows[0].count}`);
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Database connection test passed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();
EOF

node test_db.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"
else
    echo -e "${RED}❌ PostgreSQL connection failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔍 Checking installed packages...${NC}"
if grep -q "ioredis" package.json; then
    echo -e "${GREEN}✅ ioredis installed${NC}"
else
    echo -e "${RED}❌ ioredis not installed${NC}"
fi

echo ""
echo -e "${YELLOW}🔍 Checking cache service...${NC}"
if [ -f "src/cache/cache.service.ts" ]; then
    echo -e "${GREEN}✅ CacheService exists${NC}"
else
    echo -e "${RED}❌ CacheService not found${NC}"
fi

if [ -f "src/cache/cache.module.ts" ]; then
    echo -e "${GREEN}✅ CacheModule exists${NC}"
else
    echo -e "${RED}❌ CacheModule not found${NC}"
fi

echo ""
echo -e "${YELLOW}🔍 Checking optimized services...${NC}"
if grep -q "CacheService" src/branches/branches.service.ts; then
    echo -e "${GREEN}✅ BranchesService optimized${NC}"
else
    echo -e "${RED}❌ BranchesService not optimized${NC}"
fi

if grep -q "CacheService" src/reports/reports.service.ts; then
    echo -e "${GREEN}✅ ReportsService optimized${NC}"
else
    echo -e "${RED}❌ ReportsService not optimized${NC}"
fi

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✨ Tests completed!${NC}"
echo -e "${BLUE}================================${NC}"

# Cleanup
rm -f test_db.js

echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo -e "  1. Run: ${GREEN}cd /app/backend && yarn build${NC}"
echo -e "  2. Deploy to Vercel"
echo -e "  3. Add REDIS_URL to Vercel environment variables"
echo -e "  4. Run database_indexes.sql on your databases"
echo ""
