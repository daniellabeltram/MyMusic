import { suno, json, ERROR_HINTS } from "../lib/suno.js";

// Normalise track fields — the API has used both snake_case and camelCase.
function track(t) {
  return {
    id: t.id,
    title: t.title || "Untitled",
    tags: t.tags || "",
    prompt: t.prompt || "",
    duration: t.duration || null,
    audioUrl: t.audioUrl || t.audio_url || t.sourceAudioUrl || t.source_audio_url || "",
    streamUrl: t.streamAudioUrl || t.stream_audio_url || t.sourceStreamAudioUrl || t.source_stream_audio_url || "",
    imageUrl: t.imageUrl || t.image_url || t.sourceImageUrl || t.source_image_url || "",
    createTime: t.createTime || null,
  };
}

export default async (req) => {
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) return json({ error: "taskId is required" }, 400);

  const result = await suno(`/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (result.code !== 200 || !result.data) {
    return json({ error: result.msg || ERROR_HINTS[result.code] || "Lookup failed", code: result.code }, 502);
  }
  const d = result.data;
  const tracks = (d.response?.sunoData || d.response?.data || []).map(track);
  return json({
    taskId: d.taskId,
    status: d.status,
    errorMessage: d.errorMessage || null,
    tracks,
  });
};
