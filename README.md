# Ayan

AI editor for Mongolian talking-head video. Upload a short recording, and Ayan places captions, text, and supporting visuals on a vertical Reel timeline.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env.local`.

`NEXT_PUBLIC_DEMO_MODE=true` runs the sample studio without Duudlaga, Gemini, Pexels, or Postgres. Leave the variable unset and demo mode stays on as well. Set it to `false` before a real upload.

Real upload also needs FFmpeg on the machine, plus these server-side keys:

- `DUUDLAGA_API_KEY` from the [Duudlaga Flow developer console](https://duudlaga.dev/en/corporate). The key is sent only from the server to `POST /v1/stt/transcriptions`. Do not put it in a `NEXT_PUBLIC_` variable.
- `GEMINI_API_KEY` for transcript analysis.
- `PEXELS_API_KEY` for supporting visuals.
- `DATABASE_URL` is optional. Without it, videos are stored on disk.
