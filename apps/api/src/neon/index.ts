import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import pg from 'pg';

const { Client } = pg;

export interface NeonConfig {
  databaseUrl?: string;
  databaseUrlUnpooled?: string;
  authBaseUrl?: string;
  authJwksUrl?: string;
  aiGatewayBaseUrl?: string;
  aiGatewayToken?: string;
  s3Endpoint?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  functionHostSuffix?: string;
  realtimeUrl?: string;
  realtimeSecret?: string;
}

export function getNeonConfigFromEnv(env: Record<string, any> = process.env): NeonConfig {
  return {
    databaseUrl: env.DATABASE_URL,
    databaseUrlUnpooled: env.DATABASE_URL_UNPOOLED,
    authBaseUrl: env.NEON_AUTH_BASE_URL,
    authJwksUrl: env.NEON_AUTH_JWKS_URL,
    aiGatewayBaseUrl: env.NEON_AI_GATEWAY_BASE_URL,
    aiGatewayToken: env.NEON_AI_GATEWAY_TOKEN,
    s3Endpoint: env.AWS_ENDPOINT_URL_S3,
    s3Region: env.AWS_REGION || 'us-east-2',
    s3AccessKeyId: env.AWS_ACCESS_KEY_ID,
    s3SecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    functionHostSuffix: env.NEON_FUNCTION_HOST_SUFFIX,
    realtimeUrl: env.NEON_REALTIME_URL,
    realtimeSecret: env.NEON_REALTIME_SECRET,
  };
}

/**
 * 1. Neon Lakebase Postgres Service
 */
export async function testPostgresConnection(config: NeonConfig) {
  const url = config.databaseUrlUnpooled || config.databaseUrl;
  if (!url) throw new Error('Missing DATABASE_URL');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query('SELECT NOW() as now, count(*) as count FROM businesses');
  await client.end();
  return {
    status: 'connected',
    serverTime: res.rows[0].now,
    businessCount: parseInt(res.rows[0].count, 10),
  };
}

/**
 * 2. Neon Auth Service (Managed Better Auth)
 */
export async function testAuthService(config: NeonConfig) {
  if (!config.authJwksUrl) return { status: 'skipped', reason: 'No NEON_AUTH_JWKS_URL' };
  const res = await fetch(config.authJwksUrl);
  if (!res.ok) throw new Error(`Auth JWKS responded with HTTP ${res.status}`);
  const jwks = (await res.json()) as any;
  return {
    status: 'connected',
    keysCount: (jwks.keys || []).length,
    jwksUrl: config.authJwksUrl,
  };
}

/**
 * 3. Neon Object Storage Service (S3-compatible)
 */
export function getS3Client(config: NeonConfig): S3Client | null {
  if (!config.s3Endpoint || !config.s3AccessKeyId || !config.s3SecretAccessKey) {
    return null;
  }
  return new S3Client({
    region: config.s3Region || 'us-east-2',
    endpoint: config.s3Endpoint,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
    forcePathStyle: true,
  });
}

export async function uploadToStorage(config: NeonConfig, bucket: string, key: string, content: Buffer | string, contentType = 'text/plain') {
  const s3 = getS3Client(config);
  if (!s3) throw new Error('Object Storage credentials not configured');
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(content),
    ContentType: contentType,
  }));
  return { uploaded: true, bucket, key };
}

export async function listStorageObjects(config: NeonConfig, bucket: string) {
  const s3 = getS3Client(config);
  if (!s3) throw new Error('Object Storage credentials not configured');
  const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  return (res.Contents || []).map((o) => ({ key: o.Key, size: o.Size, lastModified: o.LastModified }));
}

/**
 * 4. Neon AI Gateway Service
 */
export async function testAiGateway(config: NeonConfig) {
  if (!config.aiGatewayBaseUrl || !config.aiGatewayToken) {
    return { status: 'skipped', reason: 'Missing AI Gateway credentials' };
  }
  const url = `${config.aiGatewayBaseUrl}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.aiGatewayToken}` },
  });
  const data = await res.json().catch(() => ({}));
  return {
    status: res.ok ? 'connected' : 'restricted',
    httpStatus: res.status,
    baseUrl: config.aiGatewayBaseUrl,
    details: data,
  };
}

/**
 * 5. Neon Functions Service (Serverless Compute)
 */
export async function testNeonFunction(functionUrl: string) {
  const res = await fetch(functionUrl);
  const text = await res.text();
  return {
    status: res.ok ? 'success' : 'failed',
    httpStatus: res.status,
    response: text.trim(),
  };
}

/**
 * 6. Neon Realtime Service
 */
export function getRealtimeConfig(config: NeonConfig) {
  return {
    status: config.realtimeUrl ? 'configured' : 'missing',
    url: config.realtimeUrl,
  };
}
