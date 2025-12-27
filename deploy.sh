#!/bin/bash

# Renk kodları
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}   Micrapor Deployment Script${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Backend build
echo -e "${YELLOW}📦 Building backend...${NC}"
cd backend
yarn install --production=false
yarn build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Backend build successful${NC}"
echo ""

# Frontend build
echo -e "${YELLOW}📦 Building frontend...${NC}"
cd ../frontend
yarn install --production=false
yarn build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend build successful${NC}"
echo ""

# Git check
cd ..
echo -e "${YELLOW}🔍 Checking git status...${NC}"
git status

echo ""
echo -e "${BLUE}Ready to deploy!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Review changes: ${GREEN}git status${NC}"
echo -e "  2. Add files: ${GREEN}git add .${NC}"
echo -e "  3. Commit: ${GREEN}git commit -m 'feat: PostgreSQL optimization + Redis cache'${NC}"
echo -e "  4. Push: ${GREEN}git push origin main${NC}"
echo -e "  5. Deploy to Vercel: ${GREEN}vercel --prod${NC}"
echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✨ Build completed successfully!${NC}"
echo -e "${BLUE}================================${NC}"
