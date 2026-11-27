if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_fZLlE2OgH9qV@ep-flat-term-betxfq9o-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require';
}

import { app } from './apps/api/src/index';

export default app;
