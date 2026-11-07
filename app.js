(function () {
    const { categories, categoryOrder, phrases, speechText } = PHRASEBOOK;
    const $ = (sel, root = document) => root.querySelector(sel);
    const main = $('#main');
    const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    let toastTimer;
    function toast(msg) {
        const t = $('#toast'); t.textContent = msg; t.classList.add('on');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3500);
    }

    // ---------- Speed ----------
    let speed = 'normal'; // 'normal' | 'slow'
    try { if (localStorage.getItem('wir_speed') === 'slow') speed = 'slow'; } catch (e) {}
    const SPEED_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    const speedBtn = $('#speed');
    function showSpeed() {
        speedBtn.innerHTML = SPEED_ICON + (speed === 'slow' ? 'Slow' : 'Normal');
        speedBtn.setAttribute('aria-pressed', String(speed === 'slow'));
    }
    speedBtn.onclick = () => {
        speed = speed === 'slow' ? 'normal' : 'slow';
        try { localStorage.setItem('wir_speed', speed); } catch (e) {}
        showSpeed();
        toast(speed === 'slow' ? 'Slow speech' : 'Normal speed');
    };
    showSpeed();

    // ---------- Recordings (play offline, sound the same on every phone) ----------
    // audio/index.json maps speech text -> { normal, slow } mp3 names; written by tools/generate-audio.mjs.
    // Files are loaded into blob URLs up front so play() can run synchronously inside the tap
    // (iOS blocks play() after an await) and are kept in CacheStorage for offline use.
    const AUDIO_CACHE = 'wir-audio-v1';
    const recordings = new Map(); // text -> { normal: blobUrl, slow: blobUrl }

    async function loadRecordings() {
        let cache = null;
        try { if ('caches' in window) cache = await caches.open(AUDIO_CACHE); } catch (e) {}

        const indexUrl = new URL('audio/index.json', location.href).href;
        let index;
        try {
            const res = await fetch(indexUrl, { cache: 'no-cache' });
            if (!res.ok) return;
            if (cache) await cache.put(indexUrl, res.clone());
            index = await res.json();
        } catch (e) {
            try {
                const cached = cache && await cache.match(indexUrl);
                if (!cached) return;
                index = await cached.json();
            } catch (err) { return; }
        }

        const wanted = new Set([indexUrl]);
        for (const [text, files] of Object.entries(index)) {
            const urls = {};
            for (const [kind, file] of Object.entries(files)) {
                const url = new URL(`audio/${file}`, location.href).href;
                wanted.add(url);
                try {
                    let res = cache && await cache.match(url);
                    if (!res) {
                        res = await fetch(url);
                        if (!res.ok) continue;
                        if (cache) await cache.put(url, res.clone());
                    }
                    urls[kind] = URL.createObjectURL(await res.blob());
                } catch (e) {}
            }
            if (urls.normal || urls.slow) recordings.set(text, urls);
        }

        // Drop recordings from an older index.
        if (cache) {
            try {
                for (const req of await cache.keys()) if (!wanted.has(req.url)) await cache.delete(req);
            } catch (e) {}
        }
    }
    loadRecordings();

    // ---------- Playback: recording first, phone's Italian voice as the fallback ----------
    let voices = [];
    function loadVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
    if (window.speechSynthesis) { loadVoices(); speechSynthesis.addEventListener?.('voiceschanged', loadVoices); }

    let token = 0, current = null, currentBtn = null;
    function stop() {
        token++;
        if (current) {
            try { current.onended = current.onerror = null; current.pause(); current.removeAttribute('src'); current.load(); } catch (e) {}
            current = null;
        }
        if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
        if (currentBtn) { currentBtn.classList.remove('speaking'); currentBtn = null; }
    }
    function done(t) {
        if (t !== token) return;
        if (currentBtn) currentBtn.classList.remove('speaking');
        currentBtn = current = null;
    }

    function speakWithDevice(text, t) {
        if (!window.speechSynthesis) { toast('Speech is not supported on this device.'); return done(t); }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'it-IT'; u.rate = speed === 'slow' ? 0.6 : 0.85;
        const v = voices.find(v => /^it([-_]|$)/i.test(v.lang) && (navigator.onLine || v.localService !== false));
        if (v) u.voice = v;
        else if (voices.length) toast('No Italian voice installed. Add one in your phone\'s speech settings.');
        u.onend = () => done(t);
        u.onerror = () => done(t);
        speechSynthesis.speak(u);
    }

    function speak(text, btn) {
        stop();
        const t = token;
        if (btn) { currentBtn = btn; btn.classList.add('speaking'); }

        const rec = recordings.get(text);
        const src = rec && (speed === 'slow' ? rec.slow || rec.normal : rec.normal || rec.slow);
        if (!src) return speakWithDevice(text, t);

        // No dedicated slow file: slow the normal one down (pitch is kept).
        const rate = speed === 'slow' && src === rec.normal ? 0.7 : 1;
        const audio = new Audio();
        current = audio;
        audio.preservesPitch = true;
        audio.defaultPlaybackRate = audio.playbackRate = rate;
        audio.onended = () => done(t);
        audio.onerror = () => { if (t === token) speakWithDevice(text, t); };
        audio.src = src;
        const p = audio.play();
        if (p) p.catch(() => { if (t === token) speakWithDevice(text, t); });
    }
    const sayOf = (p) => speechText(p);

    // ---------- Overlays ----------
    function openOverlay(el) { el.classList.add('on'); $('[data-body]', el).classList.remove('flip'); }
    document.querySelectorAll('.overlay').forEach(el => {
        $('[data-close]', el).onclick = () => el.classList.remove('on');
        $('[data-flip]', el).onclick = () => $('[data-body]', el).classList.toggle('flip');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.overlay.on').forEach(o => o.classList.remove('on')); });

    function showPhrase(p) {
        $('#ov-cz').textContent = p.italian;
        $('#ov-sound').textContent = p.sound;
        $('#ov-en').textContent = p.english;
        $('#ov-say').onclick = (e) => speak(sayOf(p), e.currentTarget);
        openOverlay($('#ov-phrase'));
    }

    // ---------- Pieces ----------
    const icon = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const ICON = {
        say: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="9" width="3.4" height="6" rx="1.7"/><rect x="7.2" y="4" width="3.4" height="16" rx="1.7"/><rect x="12.4" y="7" width="3.4" height="10" rx="1.7"/><rect x="17.6" y="10" width="3.4" height="4" rx="1.7"/></svg>',
        show: icon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
        check: icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
        cross: icon('<path d="M6 6l12 12M18 6L6 18"/>')
    };
    // Counts are carved in Roman numerals, like the inscriptions round the city.
    function roman(n) {
        if (n <= 0) return 'N'; // nulla
        const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
        let out = '';
        for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
        return out;
    }
    const numeral = (n, label) => `<div class="numeral"><span class="rn" aria-hidden="true">${roman(n)}</span><span class="small">${esc(label)}</span></div>`;
    const viewHead = (title, sub) => `<header class="viewhead"><h1>${esc(title)}</h1><p class="small">${esc(sub)}</p></header>`;

    // ---------- Phrases ----------
    function phraseRow(p, i) {
        return `<li class="row" style="--i:${i}">
            <div class="txt"><div class="cz" lang="it">${esc(p.italian)}</div><div class="snd">${esc(p.sound)}</div><div class="en">${esc(p.english)}</div></div>
            <button class="ib say" type="button" data-say="${p.id}" aria-label="Say: ${esc(p.english)}">${ICON.say}</button>
            <button class="ib" type="button" data-show="${p.id}" aria-label="Show full screen: ${esc(p.english)}">${ICON.show}</button>
        </li>`;
    }
    function renderPhrases() {
        let n = 0;
        main.innerHTML = `<section class="slip hero">
                <p class="kicker">Italian for Martyn · Roma</p>
                <h1>When In Rome</h1>
                <p class="lead">Tap a phrase to hear it. Hold the screen up to show it to someone.</p>
                ${numeral(phrases.length, phrases.length + ' phrases')}
            </section>` + categoryOrder.map(key => {
            const c = categories[key];
            const items = phrases.filter(p => p.category === key);
            return `<section class="slip"><h2><span class="sec" aria-hidden="true">${c.latin}</span>${c.name}</h2><ul class="rows">${items.map(p => phraseRow(p, n++)).join('')}</ul></section>`;
        }).join('') + `<section class="field"><p><span class="first">Italian is said exactly as it is spelt.</span> Sound every vowel, hold double letters a beat longer, and lean on the capitals.</p></section>`;
        main.onclick = (e) => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.say) speak(sayOf(phrases.find(p => p.id == b.dataset.say)), b);
            if (b.dataset.show) showPhrase(phrases.find(p => p.id == b.dataset.show));
        };
    }

    // ---------- Flashcards ----------
    let cardIdx = 0, flipped = false;
    const cardLabel = (p, back) => back
        ? `Italian: ${p.italian}, said ${p.sound}. Tap to turn over.`
        : `English: ${p.english}. Tap to turn over and see the Italian.`;
    function renderCards() {
        const p = phrases[cardIdx];
        main.innerHTML = viewHead('Flashcards', `Card ${cardIdx + 1} of ${phrases.length}. Tap the card to turn it over.`) + `
        <div class="scene"><button class="card${flipped ? ' flipped' : ''}" type="button" data-act="flip" aria-label="${cardLabel(p, flipped)}">
            <div class="face front"><div class="big">${esc(p.english)}</div><div class="small hint">How do you say it in Italian?</div></div>
            <div class="face back"><div class="big" lang="it">${esc(p.italian)}</div><div class="snd">${esc(p.sound)}</div></div>
        </button></div>
        <div class="btns">
            <button class="btn" type="button" data-act="prev">Back</button>
            <button class="btn primary" type="button" data-act="say">${ICON.say}Say it</button>
            <button class="btn" type="button" data-act="next">Next</button>
        </div>
        <div class="btns"><button class="btn" type="button" data-act="shuffle">Shuffle the deck</button></div>`;
        main.onclick = (e) => {
            const b = e.target.closest('button'); if (!b) return;
            const a = b.dataset.act;
            if (a === 'flip') {
                // Turn the same card over (no re-render) so the CSS transition can animate.
                flipped = !flipped;
                b.classList.toggle('flipped', flipped);
                b.setAttribute('aria-label', cardLabel(p, flipped));
                if (flipped) speak(sayOf(p));
                return;
            }
            else if (a === 'say') return speak(sayOf(p));
            else if (a === 'next') { cardIdx = (cardIdx + 1) % phrases.length; flipped = false; }
            else if (a === 'prev') { cardIdx = (cardIdx - 1 + phrases.length) % phrases.length; flipped = false; }
            else if (a === 'shuffle') { shuffle(phrases); cardIdx = 0; flipped = false; toast('Deck shuffled'); }
            renderCards();
        };
    }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

    // ---------- Quiz ----------
    let quiz = null;
    function startQuiz() {
        const qs = shuffle([...phrases]).slice(0, 10).map(p => ({
            p, options: shuffle([p, ...shuffle(phrases.filter(x => x !== p)).slice(0, 3)])
        }));
        quiz = { qs, i: 0, score: 0, answered: false };
    }
    function renderQuiz() {
        if (!quiz) startQuiz();
        if (quiz.i >= quiz.qs.length) {
            const n = quiz.qs.length, s = quiz.score;
            main.innerHTML = `<section class="slip result"><div class="numeral"><span class="rn" aria-hidden="true">${roman(s)}<span class="of">/${roman(n)}</span></span></div>
                <h1 style="font-size:var(--step-head)">${s} out of ${n}</h1>
                <p class="lead">${s === n ? 'Perfetto! Not a word wrong.' : s >= n * 0.7 ? 'Molto bene! Very good.' : 'Rome wasn\'t built in a day. Try again.'}</p></section>
                <div class="btns"><button class="btn primary" type="button" data-act="again">Play again</button></div>`;
        } else {
            const q = quiz.qs[quiz.i];
            main.innerHTML = `<p class="progress small">Question ${quiz.i + 1} of ${quiz.qs.length}. ${quiz.score} right so far.</p>
                <h1 class="q">${esc(q.p.english)}</h1>
                ${q.options.map((o, k) => `<button class="opt" type="button" data-k="${k}" lang="it"><span>${esc(o.italian)}</span></button>`).join('')}
                <div class="btns" id="after" hidden><button class="btn" type="button" data-act="say">${ICON.say}Hear it</button><button class="btn primary" type="button" data-act="next">Next</button></div>`;
        }
        main.onclick = (e) => {
            const b = e.target.closest('button'); if (!b) return;
            const q = quiz.qs[quiz.i];
            if (b.dataset.act === 'again') { startQuiz(); return renderQuiz(); }
            if (b.dataset.act === 'say') return speak(sayOf(q.p));
            if (b.dataset.act === 'next') { quiz.i++; quiz.answered = false; return renderQuiz(); }
            if (b.dataset.k !== undefined && !quiz.answered) {
                quiz.answered = true;
                const right = q.options[b.dataset.k] === q.p;
                if (right) quiz.score++;
                main.querySelectorAll('.opt').forEach((el, k) => {
                    if (q.options[k] === q.p) { el.classList.add('right'); el.insertAdjacentHTML('beforeend', ICON.check); }
                    else if (el === b) { el.classList.add('wrong'); el.insertAdjacentHTML('beforeend', ICON.cross); }
                    el.disabled = true;
                });
                $('#after').hidden = false;
                speak(sayOf(q.p));
            }
        };
    }

    // ---------- Tabs ----------
    const views = { phrases: renderPhrases, cards: renderCards, quiz: renderQuiz };
    function go(tab) {
        document.querySelectorAll('nav.tabs button[data-tab]').forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === tab)));
        views[tab](); window.scrollTo(0, 0);
        try { localStorage.setItem('wir_tab', tab); } catch (e) {}
    }
    document.querySelectorAll('nav.tabs button[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
    let start = 'phrases';
    try { const t = localStorage.getItem('wir_tab'); if (views[t]) start = t; } catch (e) {}
    go(start);

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
})();
