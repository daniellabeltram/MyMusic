import { suno, json, callbackUrl, ERROR_HINTS } from "../lib/suno.js";

const MODELS = new Set(["V6", "V6_WILD", "V6_MINI"]);
const clip = (s, n) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let input;
  try {
    input = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const customMode = Boolean(input.customMode);
  const instrumental = Boolean(input.instrumental);
  const model = MODELS.has(input.model) ? input.model : "V6";

  const body = { customMode, instrumental, model, callBackUrl: callbackUrl(req) };

  if (customMode) {
    const style = clip(input.style, 1000);
    const lyrics = instrumental ? "" : clip(input.lyrics, 5000);
    const negativeTags = clip(input.negativeTags, 1000);
    if (!style && !lyrics && !negativeTags) {
      return json({ error: "Custom mode needs at least a style, lyrics, or tags to avoid." }, 400);
    }
    if (style) body.style = style;
    if (lyrics) body.lyrics = lyrics;
    if (negativeTags) body.negativeTags = negativeTags;
    const title = clip(input.title, 80);
    if (title) body.title = title;
    if (input.vocalGender === "m" || input.vocalGender === "f") body.vocalGender = input.vocalGender;
    const duration = Number(input.duration);
    if (Number.isFinite(duration) && duration >= 10 && duration <= 360) body.duration = Math.round(duration);
  } else {
    const prompt = clip(input.prompt, 3000);
    const style = clip(input.style, 1000);
    if (!prompt && !style) return json({ error: "Describe the song you want." }, 400);
    if (prompt) body.prompt = prompt;
    if (style) body.style = style;
  }

  const result = await suno("/api/v1/generate", { method: "POST", body });
  if (result.code !== 200 || !result.data?.taskId) {
    return json({ error: result.msg || ERROR_HINTS[result.code] || "Generation failed", code: result.code }, 502);
  }
  return json({ taskId: result.data.taskId });
};
