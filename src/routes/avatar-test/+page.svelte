<script>
	import Avatar from '$lib/Avatar.svelte';
	import { unlockAudio, ensureRunning, audioState } from '$lib/audio.js';

	let { data } = $props();

	const VOICES = { aidar: 'Айдар (м)', baya: 'Бая (ж)', kseniya: 'Ксения (ж)', xenia: 'Ксения 2 (ж)', eugene: 'Евгений (м)' };
	const PHRASES = [
		'Здравствуйте! Я помогу вам разобраться с беспокойством. Давайте начнём.',
		'Вспомните недавний случай, когда вы сильно беспокоились. Что тогда запустило тревогу?',
		'Хорошо. А что вас пугает в самом беспокойстве? Что, по-вашему, может случиться, если вы не остановитесь?',
		'Понимаю.'
	];
	const STATE_LABEL = { running: 'включён', suspended: 'приостановлен', interrupted: 'прерван системой', closed: 'закрыт', нет: 'ещё не включался' };

	let text = $state(PHRASES[0]);
	let speaker = $state(data.health?.speakers?.includes('xenia') ? 'xenia' : (data.health?.speakers?.[0] ?? 'xenia'));
	let mode = $state('idle');
	let level = $state(0);
	let stats = $state(null);
	let error = $state('');
	let history = $state([]);
	let soundState = $state(audioState());

	let analyser, source, raf;
	const onState = (s) => (soundState = s);

	function stop() {
		try {
			source?.stop();
		} catch {
			/* уже остановлен */
		}
		cancelAnimationFrame(raf);
		level = 0;
		mode = 'idle';
	}

	function loop() {
		const buf = new Float32Array(analyser.fftSize);
		analyser.getFloatTimeDomainData(buf);
		let sum = 0;
		for (const v of buf) sum += v * v;
		const target = Math.min(1, Math.sqrt(sum / buf.length) * 6);
		level = level * 0.4 + target * 0.6;
		raf = requestAnimationFrame(loop);
	}

	async function speak() {
		stop();
		error = '';
		// Звук включаем прямо по нажатию, до любых ожиданий — иначе iPhone его не даст
		const { resumed } = unlockAudio(onState);
		mode = 'thinking';
		const t0 = performance.now();
		try {
			const res = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text, speaker })
			});
			if (!res.ok) {
				error = (await res.json().catch(() => ({}))).error ?? `Ошибка ${res.status}`;
				mode = 'idle';
				return;
			}
			const synthMs = Number(res.headers.get('x-synth-ms')) || 0;
			const bytes = await res.arrayBuffer();
			const kb = Math.round(bytes.byteLength / 1024);
			const ctx = await ensureRunning(resumed, onState);
			if (!ctx) {
				error = `Телефон не дал включить звук (состояние: ${STATE_LABEL[soundState] ?? soundState}). Нажмите «Сказать» ещё раз.`;
				mode = 'idle';
				return;
			}
			const audio = await ctx.decodeAudioData(bytes);
			analyser = ctx.createAnalyser();
			analyser.fftSize = 1024;
			source = ctx.createBufferSource();
			source.buffer = audio;
			source.connect(analyser);
			analyser.connect(ctx.destination);
			source.onended = () => {
				cancelAnimationFrame(raf);
				level = 0;
				mode = 'idle';
			};
			source.start();
			const totalMs = Math.round(performance.now() - t0);
			stats = { synthMs, totalMs, audioSec: audio.duration.toFixed(1), kb };
			history = [{ voice: VOICES[speaker] ?? speaker, chars: text.length, ...stats }, ...history].slice(0, 10);
			mode = 'speaking';
			loop();
		} catch (e) {
			error = 'Не получилось воспроизвести: ' + (e?.message ?? e);
			mode = 'idle';
		}
	}
</script>

<h1>Проверка аватара</h1>
<p class="muted small">Прототип: голос Silero на сервере и временный рисованный аватар. Ничего не сохраняется.</p>

<div class="card">
	<Avatar {level} {mode} />
	<p class="muted small" style="text-align: center">
		{mode === 'thinking' ? 'думает…' : mode === 'speaking' ? 'говорит' : 'слушает'}
	</p>
</div>

{#if !data.health}
	<p class="error">Служба голоса не отвечает. Проверьте на сервере: systemctl status mct-tts</p>
{/if}

<div class="card">
	<label for="voice">Голос</label>
	<select id="voice" bind:value={speaker}>
		{#each data.health?.speakers ?? Object.keys(VOICES) as s}<option value={s}>{VOICES[s] ?? s}</option>{/each}
	</select>

	<label for="text">Фраза</label>
	<textarea id="text" bind:value={text} maxlength="1000"></textarea>
	<div class="row small">
		{#each PHRASES as p, i}<button type="button" class="link" onclick={() => (text = p)}>пример {i + 1}</button>{/each}
	</div>

	<div class="row" style="margin-top: 12px">
		<button type="button" class="big" style="flex: 1" onclick={speak} disabled={mode === 'thinking' || !text.trim()}>Сказать</button>
		{#if mode === 'speaking'}<button type="button" class="secondary" onclick={stop}>Стоп</button>{/if}
	</div>
	{#if error}<p class="error">{error}</p>{/if}
	<p class="muted small">Звук в браузере: {STATE_LABEL[soundState] ?? soundState}</p>
</div>

{#if stats}
	<div class="card small">
		<b>Последняя фраза:</b> от нажатия до начала речи — <b>{(stats.totalMs / 1000).toFixed(1)} с</b>
		(из них синтез на сервере {(stats.synthMs / 1000).toFixed(1)} с), длина звука {stats.audioSec} с, {stats.kb} КБ.
	</div>
{/if}

{#if history.length > 1}
	<table class="small">
		<thead><tr><th>Голос</th><th>Символов</th><th>До речи, с</th><th>Синтез, с</th><th>Звук, с</th></tr></thead>
		<tbody>
			{#each history as h}
				<tr><td>{h.voice}</td><td>{h.chars}</td><td>{(h.totalMs / 1000).toFixed(1)}</td><td>{(h.synthMs / 1000).toFixed(1)}</td><td>{h.audioSec}</td></tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if data.health}
	<p class="muted small">Служба голоса на сервере занимает {data.health.rss_mb} МБ памяти (пик).</p>
{/if}
