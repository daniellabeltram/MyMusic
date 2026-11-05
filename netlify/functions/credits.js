import { suno, json, ERROR_HINTS } from "../lib/suno.js";

export default async () => {
  const result = await suno("/api/v1/generate/credit");
  if (result.code !== 200) {
    return json({ error: result.msg || ERROR_HINTS[result.code] || "Could not load credits", code: result.code }, 502);
  }
  return json({ credits: result.data });
};
