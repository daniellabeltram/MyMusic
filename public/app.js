const $ = (id) => document.getElementById(id);
const STORE_KEY = "mymusic.library.v1";
const POLL_MS = 6000;
const TIMEOUT_MS = 10 * 60 * 1000;
const FAILED = new Set(["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"]);
const STATUS_TEXT = {
  PENDING: "Queued…",
  TEXT_SUCCESS: "Writing the music…",
  FIRST_SUCCESS: "Almost done — preview ready",
  SUCCESS: "Ready",
  CREATE_TASK_FAILED: "Could not start",
  GENERATE_AUDIO_FAILED: "Generation failed",
  CALLBACK_EXCEPTION: "Generation failed",
  SENSITIVE_WORD_ERROR: "Blocked: prompt contains restricted words",
};

const IDEAS = [
  "Lo-fi hip hop beat for late-night studying with vinyl crackle",
  "Epic orchestral trailer music with choir and huge drums",
  "Feel-good acoustic folk song about coming home",
  "Dark synthwave track for a neon city chase",
  "Romantic R&B slow jam with smooth male vocals",
  "Happy birthday song in a punk rock style",
];
const STYLES = ["pop", "hip hop", "rock", "lo-fi", "edm", "r&b", "country", "jazz", "cinematic", "acoustic", "k-pop", "reggaeton"];

// ---------- state ----------
let mode = "simple";
let library = load();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(library)); } catch {}
}

async function api(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- UI setup ----------
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => setMode(tab.dataset.mode))
);
function setMode(m) {
  mode = m;
  document.querySelectorAll(".tab").forEach((t) => {
    const on = t.dataset.mode === m;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on);
  });
  document.querySelectorAll(".simple-only").forEach((el) => (el.hidden = m !== "simple"));
  document.querySelectorAll(".custom-only").forEach((el) => (el.hidden = m !== "custom"));
  syncInstrumental();
}

IDEAS.forEach((idea) => {
  const b = chip(idea.split(" ").slice(0, 4).join(" ") + "…");
  b.title = idea;
  b.onclick = () => { $("prompt").value = idea; $("prompt").focus(); };
  $("ideas").append(b);
});
STYLES.forEach((s) => {
  const b = chip(s);
  b.onclick = () => {
    const cur = $("style").value.split(",").map((x) => x.trim()).filter(Boolean);
    if (!cur.includes(s)) cur.push(s);
    $("style").value = cur.join(", ");
  };
  $("styleChips").append(b);
});
function chip(text) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = text;
  return b;
}

$("instrumental").addEventListener("change", syncInstrumental);
function syncInstrumental() {
  const inst = $("instrumental").checked;
  $("lyrics").disabled = inst;
  $("aiLyricsBtn").disabled = inst;
  $("lyrics").placeholder = inst ? "Instrumental — no lyrics" : "[Verse]\nCity lights are calling out my name\n\n[Chorus]\n...";
}

// ---------- credits ----------
async function refreshCredits() {
  try {
    const { credits } = await api("credits");
    $("credits").textContent = `Credits: ${credits}`;
  } catch {
    $("credits").textContent = "Credits: —";
  }
}

// ---------- AI lyrics ----------
$("aiLyricsBtn").onclick = () => {
  $("aiLyrics").hidden = !$("aiLyrics").hidden;
  if (!$("aiLyrics").hidden) $("lyricsPrompt").focus();
};
$("lyricsPrompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("lyricsGo").click(); }
});
$("lyricsGo").onclick = async () => {
  const prompt = $("lyricsPrompt").value.trim();
  if (!prompt) return;
  const btn = $("lyricsGo");
  btn.disabled = true;
  btn.textContent = "Writing…";
  $("lyricOptions").innerHTML = "";
  setError("");
  try {
    const { taskId } = await api("lyrics", { method: "POST", body: JSON.stringify({ prompt }) });
    const started = Date.now();
    while (Date.now() - started < 3 * 60 * 1000) {
      await sleep(4000);
      const r = await api(`lyrics?taskId=${encodeURIComponent(taskId)}`);
      if (r.status === "SUCCESS" && r.options.length) {
        r.options.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "lyric-option";
          b.textContent = (o.title ? `${o.title}\n\n` : "") + o.text;
          b.title = "Use these lyrics";
          b.onclick = () => {
            $("lyrics").value = o.text;
            if (o.title && !$("title").value) $("title").value = o.title;
            $("lyricOptions").innerHTML = "";
            $("aiLyrics").hidden = true;
          };
          $("lyricOptions").append(b);
        });
        return;
      }
      if (r.status && r.status !== "PENDING" && r.status !== "SUCCESS") {
        throw new Error(r.errorMessage || "Lyrics generation failed");
      }
    }
    throw new Error("Lyrics took too long — try again.");
  } catch (e) {
    setError(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Write";
  }
};

// ---------- create ----------
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");
  const instrumental = $("instrumental").checked;
  const payload = { customMode: mode === "custom", instrumental, model: $("model").value };
  let label;
  if (mode === "simple") {
    payload.prompt = $("prompt").value.trim();
    if (!payload.prompt) return setError("Describe the song you want.");
    label = payload.prompt;
  } else {
    Object.assign(payload, {
      title: $("title").value.trim(),
      style: $("style").value.trim(),
      lyrics: instrumental ? "" : $("lyrics").value.trim(),
      negativeTags: $("negativeTags").value.trim(),
      vocalGender: $("vocalGender").value,
      duration: $("duration").value ? Number($("duration").value) : undefined,
    });
    if (!payload.style && !payload.lyrics) return setError("Add a style or some lyrics.");
    label = payload.title || payload.style || "Custom song";
  }

  const btn = $("createBtn");
  btn.disabled = true;
  btn.querySelector(".label").textContent = "Starting…";
  try {
    const { taskId } = await api("generate", { method: "POST", body: JSON.stringify(payload) });
    library.unshift({
      key: taskId,
      taskId,
      title: label.length > 60 ? label.slice(0, 57) + "…" : label,
      tags: payload.style || "",
      status: "PENDING",
      createdAt: Date.now(),
      pending: true,
    });
    save();
    render();
    poll(taskId);
  } catch (err) {
    setError(err.message);
  } finally {
    btn.disabled = false;
    btn.querySelector(".label").textContent = "Create song";
  }
});

function setError(msg) { $("error").textContent = msg; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- polling ----------
const polling = new Set();
async function poll(taskId) {
  if (polling.has(taskId)) return;
  polling.add(taskId);
  try {
    while (true) {
      const entry = library.find((x) => x.taskId === taskId);
      if (!entry) return; // user removed it
      if (Date.now() - (entry.createdAt || Date.now()) > TIMEOUT_MS) {
        markFailed(taskId, "Timed out — check back later");
        return;
      }
      let r;
      try {
        r = await api(`status?taskId=${encodeURIComponent(taskId)}`);
      } catch {
        await sleep(POLL_MS * 2);
        continue;
      }
      if (FAILED.has(r.status)) {
        markFailed(taskId, r.errorMessage || STATUS_TEXT[r.status]);
        refreshCredits();
        return;
      }
      applyTracks(taskId, r);
      if (r.status === "SUCCESS") {
        refreshCredits();
        return;
      }
      await sleep(POLL_MS);
    }
  } finally {
    polling.delete(taskId);
  }
}

function applyTracks(taskId, r) {
  const placeholder = library.find((x) => x.key === taskId && x.pending);
  const usable = r.tracks.filter((t) => t.audioUrl || t.streamUrl);
  if (!usable.length) {
    if (placeholder && placeholder.status !== r.status) {
      placeholder.status = r.status;
      save();
      render();
    }
    return;
  }
  const idx = library.findIndex((x) => x.taskId === taskId);
  const createdAt = placeholder?.createdAt || Date.now();
  library = library.filter((x) => !(x.key === taskId && x.pending));
  const insertAt = idx === -1 ? 0 : Math.min(idx, library.length);
  usable.forEach((t, i) => {
    const existing = library.find((x) => x.key === t.id);
    const entry = {
      key: t.id,
      taskId,
      title: t.title,
      tags: t.tags,
      lyrics: t.prompt,
      audioUrl: t.audioUrl,
      streamUrl: t.streamUrl,
      imageUrl: t.imageUrl,
      duration: t.duration,
      status: t.audioUrl ? "SUCCESS" : r.status,
      createdAt,
    };
    if (existing) Object.assign(existing, entry);
    else library.splice(insertAt + i, 0, entry);
  });
  save();
  render();
}

function markFailed(taskId, msg) {
  library.forEach((x) => {
    if (x.taskId === taskId && x.pending) {
      x.status = "FAILED";
      x.error = msg;
      x.pending = false;
    }
  });
  save();
  render();
}

// ---------- library rendering ----------
let currentKey = null;

function render() {
  const root = $("library");
  root.innerHTML = "";
  $("empty").hidden = library.length > 0;
  $("clearBtn").hidden = library.length === 0;
  const tpl = $("trackTpl");
  for (const item of library) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const playable = item.audioUrl || item.streamUrl;
    node.classList.toggle("pending", !!item.pending || (!playable && item.status !== "FAILED"));
    node.classList.toggle("playing", item.key === currentKey);
    const img = node.querySelector(".art img");
    if (item.imageUrl) img.src = item.imageUrl;
    node.querySelector(".t-title").textContent = item.title || "Untitled";
    node.querySelector(".t-tags").textContent = [item.tags, fmtDur(item.duration)].filter(Boolean).join(" · ");
    const st = node.querySelector(".t-status");
    if (item.status === "FAILED") {
      st.textContent = item.error || "Failed";
      st.classList.add("err");
    } else if (item.status === "SUCCESS") {
      st.textContent = "Ready";
      st.classList.add("ok");
    } else {
      st.textContent = STATUS_TEXT[item.status] || "Working…";
    }

    const dl = node.querySelector(".dl");
    if (item.audioUrl) {
      dl.href = item.audioUrl;
      dl.setAttribute("download", `${(item.title || "song").replace(/[^\w\- ]+/g, "")}.mp3`);
    } else {
      dl.classList.add("disabled");
      dl.removeAttribute("href");
    }

    const lyrBtn = node.querySelector(".lyr");
    const lyrBox = node.querySelector(".t-lyrics");
    if (item.lyrics) {
      lyrBox.textContent = item.lyrics;
      lyrBtn.onclick = () => (lyrBox.hidden = !lyrBox.hidden);
    } else {
      lyrBtn.classList.add("disabled");
    }

    node.querySelector(".del").onclick = () => {
      library = library.filter((x) => x.key !== item.key);
      save();
      render();
    };
    node.querySelector(".art").onclick = () => playable && play(item);
    root.append(node);
  }
}

function fmtDur(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

function play(item) {
  const audio = $("audio");
  const src = item.audioUrl || item.streamUrl;
  if (currentKey === item.key && audio.src) {
    audio.paused ? audio.play() : audio.pause();
    return;
  }
  currentKey = item.key;
  audio.src = src;
  $("player").hidden = false;
  $("playerTitle").textContent = item.title || "Untitled";
  $("playerTags").textContent = item.tags || "";
  const art = $("playerArt");
  art.hidden = !item.imageUrl;
  if (item.imageUrl) art.src = item.imageUrl;
  audio.play().catch(() => {});
  render();
}

$("clearBtn").onclick = () => {
  if (!confirm("Remove all songs from your library? (This only clears this browser.)")) return;
  library = [];
  save();
  render();
};

// ---------- theme ----------
const THEME_KEY = "mymusic.theme";
function applyTheme(choice) {
  if (choice === "light" || choice === "dark" || choice === "red") document.documentElement.setAttribute("data-theme", choice);
  else document.documentElement.removeAttribute("data-theme");
  document.querySelectorAll("[data-theme-choice]").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.themeChoice === choice)
  );
}
let themeChoice = "system";
try { themeChoice = localStorage.getItem(THEME_KEY) || "system"; } catch {}
applyTheme(themeChoice);
document.querySelectorAll("[data-theme-choice]").forEach((b) =>
  b.addEventListener("click", () => {
    themeChoice = b.dataset.themeChoice;
    try { localStorage.setItem(THEME_KEY, themeChoice); } catch {}
    applyTheme(themeChoice);
  })
);

// ---------- musical-note border ----------
const NOTE_GLYPHS = ["♪", "♫", "♩", "♬", "♪", "♫"];
function drawNoteBorder() {
  const root = $("noteBorder");
  const w = window.innerWidth;
  const h = window.innerHeight;
  const small = w < 600;
  const inset = small ? 9 : 16;      // distance of note centres from the edge
  const gap = small ? 40 : 54;       // spacing between notes
  const size = small ? 14 : 20;
  const points = [];
  const along = (len) => {
    const n = Math.max(2, Math.round((len - inset * 2) / gap));
    return Array.from({ length: n + 1 }, (_, i) => inset + ((len - inset * 2) * i) / n);
  };
  along(w).forEach((x) => { points.push([x, inset]); points.push([x, h - inset]); });
  along(h).slice(1, -1).forEach((y) => { points.push([inset, y]); points.push([w - inset, y]); });

  const frag = document.createDocumentFragment();
  points.forEach(([x, y], i) => {
    const el = document.createElement("span");
    el.className = "note" + (i % 3 === 1 ? " alt" : "");
    el.textContent = NOTE_GLYPHS[i % NOTE_GLYPHS.length];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.fontSize = `${size + ((i * 7) % 5) - 2}px`;
    el.style.setProperty("--r", `${((i * 37) % 30) - 15}deg`);
    el.style.setProperty("--dur", `${5 + ((i * 13) % 4)}s`);
    el.style.setProperty("--delay", `${-((i * 0.7) % 6)}s`);
    frag.append(el);
  });
  root.replaceChildren(frag);
}
let noteTimer;
window.addEventListener("resize", () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(drawNoteBorder, 150);
});
drawNoteBorder();

// ---------- inspiration banner ----------
const INSPIRATION = [
  "Every great song started as a feeling someone decided to share.",
  "You don't need to be a musician to have music inside you.",
  "Hum the melody in your head — today it gets to be heard.",
  "Your story deserves a soundtrack. Write the first line.",
  "There are no wrong notes when you're creating something new.",
  "Turn the moment you never want to forget into a song.",
  "Somewhere, someone needs to hear the song only you can make.",
  "Start with one idea. The music will find the rest.",
  "Make it loud, make it soft — just make it yours.",
  "Every chorus begins with the courage to try.",
];
let inspireIdx = 0;
let inspireTimer;
function nextInspiration() {
  const el = $("inspireText");
  inspireIdx = (inspireIdx + 1) % INSPIRATION.length;
  el.classList.add("fade");
  setTimeout(() => {
    el.textContent = INSPIRATION[inspireIdx];
    el.classList.remove("fade");
  }, 350);
}
function startInspiration() {
  clearInterval(inspireTimer);
  inspireTimer = setInterval(nextInspiration, 9000);
}
$("inspire").addEventListener("click", () => { nextInspiration(); startInspiration(); });
inspireIdx = Math.floor(Math.random() * INSPIRATION.length);
$("inspireText").textContent = INSPIRATION[inspireIdx];
startInspiration();

// ---------- boot ----------
setMode("simple");
render();
refreshCredits();
// Resume any generations still in progress from a previous visit.
[...new Set(library.filter((x) => x.status !== "SUCCESS" && x.status !== "FAILED").map((x) => x.taskId))].forEach(poll);
