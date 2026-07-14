import { Router, Request, Response } from 'express';
import multer from 'multer';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

// Only mounted in local/dev mode (STORAGE_MODE=local)
export const storageUploadRoutes = Router();

const mem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

storageUploadRoutes.post('/', mem.single('file'), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'No file' }); return; }

  const bucket = (req.query.bucket as string) || 'uploads';
  const path   = (req.query.path   as string) || file.originalname;
  const base   = process.env.LOCAL_UPLOAD_DIR || './uploads';
  const dest   = join(base, bucket, path);

  try {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.buffer);
    res.json({ path, bucket, url: `/uploads/${bucket}/${path}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
