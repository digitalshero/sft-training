// Two-tier cache for parsed deck slides, keyed by the deck's storage path.
// Memory tier is instant but empty after every restart — ts-node-dev
// restarts the whole process on every file save during development, which
// would otherwise silently discard the cache constantly. The disk tier
// survives restarts, so the (very) expensive first parse only ever happens
// once per deck, not once per dev-server reload.
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import type { ParsedSlide } from './pptx-parser';

const CACHE_DIR = join(process.cwd(), '.cache', 'deck-slides');
const memoryCache = new Map<string, Promise<ParsedSlide[]>>();

function cacheFilePath(filePath: string): string {
  const hash = createHash('sha1').update(filePath).digest('hex');
  return join(CACHE_DIR, `${hash}.json`);
}

export async function getCachedSlides(
  filePath: string,
  compute: () => Promise<ParsedSlide[]>,
): Promise<ParsedSlide[]> {
  const inMemory = memoryCache.get(filePath);
  if (inMemory) return inMemory;

  const promise = (async () => {
    const diskPath = cacheFilePath(filePath);
    if (existsSync(diskPath)) {
      return JSON.parse(await readFile(diskPath, 'utf8')) as ParsedSlide[];
    }
    const slides = await compute();
    mkdirSync(CACHE_DIR, { recursive: true });
    await writeFile(diskPath, JSON.stringify(slides));
    return slides;
  })();

  memoryCache.set(filePath, promise);
  promise.catch(() => memoryCache.delete(filePath)); // don't cache a failed attempt
  return promise;
}
