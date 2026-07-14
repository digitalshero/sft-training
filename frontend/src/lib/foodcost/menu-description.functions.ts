import api from "@/lib/api/client";

// Replaced Lovable AI gateway with direct OpenAI TTS proxy on /api/tts
// Menu description generation uses a simple REST call
export const generateMenuDescription = (d: {
  product_name: string;
  ingredients?: string;
  cuisine?: string;
  language?: string;
}) => api.post("/foodcost/generate-menu-description", d).then((r) => r.data);
