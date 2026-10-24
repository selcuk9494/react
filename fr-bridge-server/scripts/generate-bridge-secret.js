'use strict';

/**
 * BRIDGE_INTERNAL_SECRET üretir — stdout'a yazar; dosyaya/Git'e yazmaz.
 *
 *   node scripts/generate-bridge-secret.js
 *   openssl rand -base64 32
 */
const { randomBytes } = require('crypto');

const secret = randomBytes(32).toString('base64url');
process.stdout.write(secret + '\n');
process.stderr.write(
  'Bu değeri Render ve (sonra) Vercel env olarak yapıştırın. Git/commit/log\'a koymayın.\n',
);
