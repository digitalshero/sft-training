// Client-side PPTX parser. Extracts per-slide text + presenter notes.
// We don't render the original PPTX visuals — we display the extracted
// text in a clean slide template and use the presenter notes for voiceover.

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface ParsedSlide {
  index: number; // 1-based
  title: string;
  bullets: string[];
  notes: string; // presenter notes (drives the TTS voiceover)
}

interface AnyNode {
  [k: string]: unknown;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// Walk the XML tree and collect every <a:t> text, grouped by paragraph (<a:p>).
function extractParagraphs(node: unknown): string[] {
  const out: string[] = [];
  walk(node, out, []);
  return out.filter((s) => s.trim().length > 0);

  function walk(n: unknown, paragraphs: string[], current: string[] | null) {
    if (n == null || typeof n !== "object") return;
    const obj = n as AnyNode;
    for (const [key, val] of Object.entries(obj)) {
      if (key === "a:p") {
        for (const p of asArray(val)) {
          const buf: string[] = [];
          walk(p, paragraphs, buf);
          paragraphs.push(buf.join("").trim());
        }
      } else if (key === "a:t") {
        for (const t of asArray(val)) {
          if (current == null) continue;
          if (typeof t === "string") current.push(t);
          else if (t && typeof t === "object" && "#text" in (t as AnyNode)) {
            current.push(String((t as AnyNode)["#text"] ?? ""));
          }
        }
      } else if (val && typeof val === "object") {
        walk(val, paragraphs, current);
      }
    }
  }
}

export async function parsePptx(buffer: ArrayBuffer): Promise<ParsedSlide[]> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: false,
  });

  // Discover slides in order. presentation.xml.rels maps slide IDs in order.
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return na - nb;
    });

  // Each slide's decompression + parse is fully independent — run them
  // concurrently instead of one at a time, so total time is the slowest
  // single slide rather than the sum of every slide in the deck.
  const slides = await Promise.all(
    slideFiles.map(async (slidePath, i) => {
      const idx = i + 1;
      const slideXml = await zip.files[slidePath].async("string");
      const slideObj = parser.parse(slideXml);
      const paragraphs = extractParagraphs(slideObj);
      const title = paragraphs[0] ?? `Slide ${idx}`;
      const bullets = paragraphs.slice(1);

      const notesPath = `ppt/notesSlides/notesSlide${idx}.xml`;
      let notes = "";
      if (zip.files[notesPath]) {
        const notesXml = await zip.files[notesPath].async("string");
        const notesObj = parser.parse(notesXml);
        const notesParas = extractParagraphs(notesObj)
          // Strip slide-number placeholders some templates add at the bottom.
          .filter((p) => !/^\d+$/.test(p.trim()));
        notes = notesParas.join(" ").trim();
      }

      return { index: idx, title, bullets, notes };
    }),
  );
  return slides;
}
