import { neon } from '@neondatabase/serverless';
import { Env } from './types';

export function getDb(env: Env) {
  if (env.DATABASE_URL) {
    return neon(env.DATABASE_URL);
  }
  return null;
}
