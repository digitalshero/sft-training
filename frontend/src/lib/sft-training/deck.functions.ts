import api from "@/lib/api/client";

export interface DeckRow {
  id: string;
  name: string;
  file_path: string;
  pdf_path?: string | null;
  voice: string;
  speed: number;
  autoplay_advance: boolean;
  active: boolean;
  uploaded_at: string;
}

export const getActiveDeck = (): Promise<DeckRow | null> =>
  api.get("/sft/decks/active").then((r) => r.data);

export const listDecks = (): Promise<DeckRow[]> =>
  api.get("/sft/decks").then((r) => r.data);

export const registerDeck = (d: {
  name: string;
  file_path: string;
  pdf_path?: string | null;
}) => api.post("/sft/decks", d).then((r) => r.data);

export const updateDeckSettings = (
  d: { id: string } & Record<string, unknown>,
) => {
  const { id, ...b } = d;
  return api.patch(`/sft/decks/${id}`, b).then((r) => r.data);
};

export const getDeckById = (id: string): Promise<DeckRow> =>
  api.get(`/sft/decks/${id}`).then((r) => r.data);

export const getDeckSignedUrl = async (d: {
  id?: string;
  file_path?: string;
}) => {
  const deck = d.id ? await getDeckById(d.id) : await getActiveDeck();
  if (!deck) return { url: null, pdfUrl: null };
  const res = await api
    .post(`/sft/decks/${deck.id}/signed-url`, {})
    .then((r) => r.data);
  return { url: res.url ?? null, pdfUrl: res.pdfUrl ?? null };
};
