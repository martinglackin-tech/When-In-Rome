// Generates audio/*.mp3 for every phrase, in two speeds, plus audio/index.json
// (speech text -> { normal, slow } file names), using the Google Cloud Text-to-Speech API.
//
// Usage:
//   GOOGLE_TTS_API_KEY=... node tools/generate-audio.mjs
//
// Optional: TTS_VOICE (default it-IT-Wavenet-A), SLOW_RATE (default 0.65).
// Files that already exist are kept, so re-running after adding a phrase only
// synthesises the new text. "Slow" is synthesised natively rather than just played back
// slower in the browser, so it stays clear and natural instead of sounding stretched.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = join(root, 'audio');
const apiKey = process.env.GOOGLE_TTS_API_KEY;
const voice = process.env.TTS_VOICE || 'it-IT-Wavenet-A';
const speeds = { normal: 1.0, slow: parseFloat(process.env.SLOW_RATE || '0.65') };

if (!apiKey) {
    console.error('Set GOOGLE_TTS_API_KEY to a Google Cloud API key with the Text-to-Speech API enabled.');
    process.exit(1);
}

// data.js is a browser script that sets globalThis.PHRASEBOOK.
const context = {};
vm.runInNewContext(readFileSync(join(root, 'data.js'), 'utf8'), context);
const { allSpeechTexts } = context.PHRASEBOOK;

async function synthesize(text, speakingRate) {
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'it-IT', name: voice },
            audioConfig: { audioEncoding: 'MP3', speakingRate }
        })
    });
    if (!response.ok) {
        throw new Error(`TTS request failed for "${text}": ${response.status} ${await response.text()}`);
    }
    const { audioContent } = await response.json();
    return Buffer.from(audioContent, 'base64');
}

mkdirSync(audioDir, { recursive: true });

const index = {};
for (const text of allSpeechTexts()) {
    index[text] = {};
    for (const [speed, rate] of Object.entries(speeds)) {
        const file = `${createHash('sha1').update(`${voice}\n${rate}\n${text}`).digest('hex').slice(0, 12)}.mp3`;
        index[text][speed] = file;
        if (existsSync(join(audioDir, file))) continue;
        console.log(`Synthesising (${speed}): ${text}`);
        writeFileSync(join(audioDir, file), await synthesize(text, rate));
    }
}

const wanted = new Set(Object.values(index).flatMap(v => Object.values(v)));
for (const file of readdirSync(audioDir)) {
    if (file.endsWith('.mp3') && !wanted.has(file)) {
        console.log(`Removing unused ${file}`);
        unlinkSync(join(audioDir, file));
    }
}

writeFileSync(join(audioDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${wanted.size} recordings to audio/index.json`);
