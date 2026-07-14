import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { writeFile, unlink, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';

const STORAGE_MODE = process.env.STORAGE_MODE || 'local';
const LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || './uploads';
const SIGNED_URL_TTL = parseInt(process.env.AWS_S3_SIGNED_URL_TTL || '3600', 10);

// Bucket name map — env var names match this project's actual .env keys
// (AWS_S3_BUCKET_SFT_DECKSS etc.), which in turn match the real bucket names
// created in AWS (confirmed via a live ListBuckets call: shero-sft-deckss,
// shero-sft-videoss, shero-sft-practicess, shero-learning-mediass).
const BUCKET_MAP: Record<string, string> = {
  'sft-decks':       process.env.AWS_S3_BUCKET_SFT_DECKSS       || 'shero-sft-deckss',
  'sft-videos':      process.env.AWS_S3_BUCKET_SFT_VIDEOSS      || 'shero-sft-videoss',
  'sft-practice':    process.env.AWS_S3_BUCKET_SFT_PRACTICESS   || 'shero-sft-practicess',
  'learning-media':  process.env.AWS_S3_BUCKET_LEARNING_MEDIASS || 'shero-learning-mediass',
};

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

function resolveS3Bucket(bucket: string): string {
  return BUCKET_MAP[bucket] || bucket;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (STORAGE_MODE === 's3') {
    await getS3().send(new PutObjectCommand({
      Bucket:      resolveS3Bucket(bucket),
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    }));
    return key;
  }

  // Local
  const dest = join(LOCAL_UPLOAD_DIR, bucket, key);
  mkdirSync(dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  return key;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteFile(bucket: string, key: string): Promise<void> {
  if (STORAGE_MODE === 's3') {
    await getS3().send(new DeleteObjectCommand({
      Bucket: resolveS3Bucket(bucket),
      Key:    key,
    }));
    return;
  }

  const dest = join(LOCAL_UPLOAD_DIR, bucket, key);
  if (existsSync(dest)) await unlink(dest);
}

// ── Fetch file bytes (server-side) ───────────────────────────────────────────

export async function getFileBuffer(bucket: string, key: string): Promise<Buffer> {
  if (STORAGE_MODE === 's3') {
    const res = await getS3().send(new GetObjectCommand({ Bucket: resolveS3Bucket(bucket), Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  return readFile(join(LOCAL_UPLOAD_DIR, bucket, key));
}

// ── Signed URL ────────────────────────────────────────────────────────────────

export async function createSignedUrl(
  bucket: string,
  key: string,
  ttlSeconds = SIGNED_URL_TTL,
): Promise<string> {
  if (STORAGE_MODE === 's3') {
    const cmd = new GetObjectCommand({ Bucket: resolveS3Bucket(bucket), Key: key });
    return getSignedUrl(getS3(), cmd, { expiresIn: ttlSeconds });
  }

  // Local: return a plain URL served by Express /uploads
  return `/uploads/${bucket}/${key}`;
}

// ── Signed Upload URL (presigned PUT) ─────────────────────────────────────────

export async function createSignedUploadUrl(
  bucket: string,
  key: string,
  ttlSeconds = 600,
): Promise<{ signedUrl: string; path: string; token?: string }> {
  if (STORAGE_MODE === 's3') {
    const cmd = new PutObjectCommand({ Bucket: resolveS3Bucket(bucket), Key: key });
    const signedUrl = await getSignedUrl(getS3(), cmd, { expiresIn: ttlSeconds });
    return { signedUrl, path: key };
  }

  // Local dev: return a POST endpoint URL — client hits /api/storage/upload
  const token = randomUUID();
  return { signedUrl: `/api/storage/upload?bucket=${bucket}&path=${encodeURIComponent(key)}&token=${token}`, path: key, token };
}

// ── Sign a list of file paths ─────────────────────────────────────────────────

export async function signFilePaths(
  bucket: string,
  paths: (string | null | undefined)[],
  ttlSeconds = SIGNED_URL_TTL,
): Promise<(string | null)[]> {
  return Promise.all(
    paths.map(p => (p ? createSignedUrl(bucket, p, ttlSeconds) : Promise.resolve(null))),
  );
}
