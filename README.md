# Ayan

AI editor for Mongolian talking-head video. Upload a short recording, and Ayan places captions, text, and supporting visuals on a vertical Reel timeline.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env.local` before connecting Gemini, Chimege, or Postgres. Leave `NEXT_PUBLIC_DEMO_MODE` unset, or set it to anything other than `false`, and the app stays in demo mode with the sample analysis. Real upload also needs FFmpeg on the machine.
