// Голос и сигнал для упражнений и вечернего окна.
// unlock() вызывать прямо в обработчике нажатия — иначе iPhone не даст звук.
import { unlockAudio, ensureRunning } from '$lib/audio.js';

export function createVoice() {
	let unlocked = null;
	let current = null;
	let stopped = false;
	const cache = new Map();

	function load(text, speaker) {
		const key = speaker + '|' + text;
		if (!cache.has(key)) {
			const p = fetch('/api/tts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: text.slice(0, 1000), speaker })
			}).then(async (res) => {
				if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.status);
				return res.arrayBuffer();
			});
			p.catch(() => cache.delete(key));
			cache.set(key, p);
		}
		return cache.get(key);
	}

	async function ctx() {
		if (!unlocked) return null;
		return ensureRunning(unlocked.resumed);
	}

	return {
		unlock() {
			stopped = false;
			unlocked = unlockAudio();
		},
		preload(text, speaker) {
			load(text, speaker).catch(() => {});
		},
		/** Произносит текст; промис завершается, когда фраза договорена. */
		async say(text, speaker) {
			if (stopped) return;
			const bytes = await load(text, speaker);
			const c = await ctx();
			if (!c || stopped) return;
			const buf = await c.decodeAudioData(bytes.slice(0));
			if (stopped) return;
			await new Promise((resolve) => {
				current = c.createBufferSource();
				current.buffer = buf;
				current.connect(c.destination);
				current.onended = resolve;
				current.start();
			});
		},
		/** Мягкий двойной сигнал (без сервера). */
		async chime() {
			const c = await ctx();
			if (!c) return;
			[0, 0.35].forEach((delay, i) => {
				const t = c.currentTime + delay;
				const osc = c.createOscillator();
				const gain = c.createGain();
				osc.frequency.value = i ? 660 : 880;
				gain.gain.setValueAtTime(0.0001, t);
				gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
				gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
				osc.connect(gain).connect(c.destination);
				osc.start(t);
				osc.stop(t + 1);
			});
		},
		stop() {
			stopped = true;
			try {
				current?.stop();
			} catch {
				/* уже остановлен */
			}
		}
	};
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function readSpeaker() {
	try {
		return localStorage.getItem('talk.speaker') || 'xenia';
	} catch {
		return 'xenia';
	}
}

/** Делит текст на куски до n знаков по границам предложений — для озвучки длинных ответов. */
export function chunks(text, n = 900) {
	const out = [];
	let cur = '';
	for (const s of (text ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/)) {
		if (!s) continue;
		if (cur && (cur + ' ' + s).length > n) {
			out.push(cur);
			cur = '';
		}
		cur = cur ? cur + ' ' + s : s;
		while (cur.length > n) {
			out.push(cur.slice(0, n));
			cur = cur.slice(n);
		}
	}
	if (cur) out.push(cur);
	return out;
}
