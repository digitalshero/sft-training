import { Router, Request, Response, NextFunction } from 'express';

export const ttsRoutes = Router();

// ElevenLabs accepts up to ~5000 characters per request; stay comfortably
// under that so a single slow chunk can't blow past the request timeout.
const MAX_CHARS_PER_CHUNK = 2000;

function chunkText(text: string, maxChars = MAX_CHARS_PER_CHUNK): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
}

// The account's voice library rarely changes, so cache it instead of calling
// ElevenLabs on every page load / voice-picker render.
let voiceCache: { voices: ElevenLabsVoice[]; fetchedAt: number } | null = null;
const VOICE_CACHE_TTL_MS = 10 * 60 * 1000;

// Used when the configured key can't list the account's voice library (e.g.
// a restricted key missing the "voices_read" permission) — text-to-speech
// generation itself doesn't require that permission, so narration can still
// work as long as we have known-good voice ids to send. These are
// ElevenLabs' premade library voices, individually verified against this
// account's key via a live generation call (all returned 200).
const FALLBACK_VOICES: ElevenLabsVoice[] = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', labels: { gender: 'female' } },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', labels: { gender: 'female' } },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', labels: { gender: 'female' } },
  { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', labels: { gender: 'female' } },
  { voice_id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', labels: { gender: 'female' } },
  { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', labels: { gender: 'female' } },
];

async function fetchVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  if (voiceCache && Date.now() - voiceCache.fetchedAt < VOICE_CACHE_TTL_MS) {
    return voiceCache.voices;
  }
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) {
    console.error(`[tts] voices lookup failed (${res.status}) — using fallback voice list`);
    voiceCache = { voices: FALLBACK_VOICES, fetchedAt: Date.now() };
    return voiceCache.voices;
  }
  const data = (await res.json()) as { voices: ElevenLabsVoice[] };
  voiceCache = { voices: data.voices?.length ? data.voices : FALLBACK_VOICES, fetchedAt: Date.now() };
  return voiceCache.voices;
}

// GET /api/tts/voices — female voices available in this account's library,
// used to populate the narration voice picker (avoids hardcoding voice IDs
// that may not exist for whichever ElevenLabs account is configured).
ttsRoutes.get('/voices', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
      return;
    }
    const voices = await fetchVoices(apiKey);
    const female = voices.filter((v) => (v.labels?.gender ?? '').toLowerCase() === 'female');
    const list = (female.length ? female : voices).map((v) => ({
      value: v.voice_id,
      label: v.name,
    }));
    res.json({ voices: list });
  } catch (e) {
    next(e);
  }
});

ttsRoutes.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
      return;
    }

    const { text, voice } = req.body as { text?: string; voice?: string };

    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      res.status(400).json({ error: 'text required' });
      return;
    }

    let voiceId = (voice || '').trim();
    if (!voiceId) {
      const voices = await fetchVoices(apiKey);
      const fallback =
        voices.find((v) => (v.labels?.gender ?? '').toLowerCase() === 'female') ?? voices[0];
      if (!fallback) {
        res.status(500).json({ error: 'No ElevenLabs voices available on this account' });
        return;
      }
      voiceId = fallback.voice_id;
    }

    const chunks = chunkText(trimmed);
    const key: string = apiKey;

    async function callElevenLabsTts(input: string) {
      return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: input,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
    }

    if (chunks.length <= 1) {
      const upstream = await callElevenLabsTts(chunks[0] ?? trimmed);
      if (!upstream.ok) {
        const msg = await upstream.text().catch(() => '');
        console.error('[tts] ElevenLabs error:', upstream.status, msg);
        res.status(upstream.status).json({ error: `TTS failed: ${msg}` });
        return;
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
      return;
    }

    // Chunks are independent — generate them concurrently instead of one at a
    // time, otherwise a long slide's total latency stacks up per-chunk and
    // can trip the frontend's request timeout. Promise.all preserves order.
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const upstream = await callElevenLabsTts(chunk);
        if (!upstream.ok) {
          const msg = await upstream.text().catch(() => '');
          console.error('[tts] ElevenLabs chunk error:', upstream.status, msg);
          return null;
        }
        return Buffer.from(await upstream.arrayBuffer());
      }),
    );
    const buffers = results.filter((b) => b !== null) as Buffer[];
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.concat(buffers));
  } catch (e) {
    next(e);
  }
});
