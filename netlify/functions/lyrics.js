import { suno, json, callbackUrl, ERROR_HINTS } from "../lib/suno.js";

// POST { prompt } -> start lyrics task. GET ?taskId= -> poll it.
export default async (req) => {
  if (req.method === "POST") {
    let input;
    try {
      input = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 200) : "";
    if (!prompt) return json({ error: "Tell me what the lyrics should be about." }, 400);
    const result = await suno("/api/v1/lyrics", {
      method: "POST",
      body: { prompt, callBackUrl: callbackUrl(req) },
    });
    if (result.code !== 200 || !result.data?.taskId) {
      return json({ error: result.msg || ERROR_HINTS[result.code] || "Lyrics request failed", code: result.code }, 502);
    }
    return json({ taskId: result.data.taskId });
  }

  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) return json({ error: "taskId is required" }, 400);
  const result = await suno(`/api/v1/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (result.code !== 200 || !result.data) {
    return json({ error: result.msg || ERROR_HINTS[result.code] || "Lookup failed", code: result.code }, 502);
  }
  const d = result.data;
  return json({
    status: d.status,
    errorMessage: d.errorMessage || null,
    options: (d.response?.data || []).map((o) => ({ title: o.title || "", text: o.text || "" })),
  });
};
