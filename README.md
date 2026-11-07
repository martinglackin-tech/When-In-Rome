# When In Rome

An Italian phrasebook for Martyn's solo trip to Rome. It's a small web app that works offline: you can hear each phrase, show it full screen to a waiter, practise with flashcards and test yourself with a quiz.

It's based on Martin & Alex's Czech phrasebook (the Czech-List repo): same app, Italian phrases, and a Roman look of travertine stone, terracotta and Roman numerals. There's no build step and nothing to install (only the optional audio script needs Node 18+).

| File | What it is |
|---|---|
| `index.html` | Page, styles and the full-screen overlay |
| `data.js` | The phrases |
| `app.js` | App logic |
| `audio/`, `tools/generate-audio.mjs` | Recordings (once generated) and the script that makes them |
| `fonts/` | Hanken Grotesk and Cormorant Garamond (both OFL), bundled so they work offline |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and "Add to Home Screen" |

## Run it

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Serve it over http(s) (for example GitHub Pages) so offline mode works. Open it once on the phone with signal, then "Add to Home Screen".
If you change the file list in `sw.js`, bump `CACHE`.

## Audio

The app uses the first of these that works:

1. **Recordings** in `audio/`: a natural neural voice that sounds the same on every phone and plays offline. Each phrase has a normal and a slow version, and the Speed button in the bottom bar switches between them.
2. **The phone's built-in Italian voice**, if there's no recording.

No recordings are committed yet. To make them, add a repository secret called `GOOGLE_TTS_API_KEY` (a Google Cloud key with the Text-to-Speech API enabled), then run **Actions → Generate audio → Run workflow**. Or run it locally:

```sh
GOOGLE_TTS_API_KEY=your-key node tools/generate-audio.mjs
```

Optional: `TTS_VOICE` (default `it-IT-Wavenet-A`) and `SLOW_RATE` (default `0.65`).

## Editing phrases

Edit `data.js`. `sound` is an English-style pronunciation guide (CAPITALS = stressed syllable).
