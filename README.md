# MyMusic — AI Song Studio

A web app where anyone can generate full songs (vocals or instrumental) from a text description, or from their own lyrics and style, powered by [sunoapi.org](https://docs.sunoapi.org).

## Features
- **Simple mode** — describe a song, get 2 versions.
- **Custom mode** — title, style tags, your own lyrics, styles to exclude, voice gender, length.
- **AI lyrics writer** — generate lyrics from a topic and drop them into the editor.
- Instrumental toggle and model picker (V6, V6 Wild, V6 Mini).
- Live status, preview streaming as soon as the first track is ready, MP3 download, lyrics view.
- Library saved in the browser; in-progress songs resume if you reload.
- Remaining-credit counter.

## How it works
```
public/               static frontend (HTML/CSS/JS, no build step)
netlify/functions/    serverless proxy to sunoapi.org (keeps the API key secret)
  generate.js         POST /api/generate   -> POST /api/v1/generate
  status.js           GET  /api/status     -> GET  /api/v1/generate/record-info
  lyrics.js           POST/GET /api/lyrics -> /api/v1/lyrics (+ record-info)
  credits.js          GET  /api/credits    -> GET  /api/v1/generate/credit
  callback.js         receives Suno's required callBackUrl pings
netlify/lib/suno.js   shared fetch helper
```
The browser never sees the API key. It calls `/api/*`, which Netlify routes to the functions, which call `https://api.sunoapi.org` with `Authorization: Bearer $SUNO_API_KEY`. Generation status is polled every few seconds.

## Deploy on Netlify
1. In Netlify: **Add new site → Import an existing project →** pick this GitHub repo.
2. Build settings are read from `netlify.toml` (publish `public`, functions `netlify/functions`). No build command needed.
3. **Site configuration → Environment variables → Add variable:**
   `SUNO_API_KEY` = your key from https://sunoapi.org/api-key
4. Deploy (or **Trigger deploy** again after adding the variable).

## Run locally
```bash
npm i -g netlify-cli
cp .env.example .env   # put your key in .env
netlify dev
```
