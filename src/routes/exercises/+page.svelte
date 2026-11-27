<script>
	import { onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { EXERCISES } from '$lib/labels.js';
	import { createVoice, sleep, readSpeaker } from '$lib/speak.js';

	let { data, form } = $props();

	const INTRO = {
		train:
			'Представьте, что вы стоите на платформе. Мысли — это вагоны поезда, которые проезжают мимо. Вы видите их, но не садитесь в вагон.',
		assoc:
			'Я буду медленно называть слова. Пусть мысли и образы приходят и уходят сами. Не удерживайте их и не прогоняйте.'
	};
	const TRAIN_PROMPTS = [
		'Просто смотрите, как мысли проезжают мимо.',
		'Если заметили, что сели в вагон и едете за мыслью, — спокойно вернитесь на платформу.',
		'Не нужно прогонять мысли и не нужно их удерживать.',
		'Мысль — это просто событие в голове. Её можно не трогать.'
	];
	// Нейтральные слова и несколько «цепляющих» — так и задумано в упражнении
	const WORDS = (
		'море стол праздник дерево окно яблоко дорога облако книга велосипед ключ кошка зима чай мост письмо гора лампа ' +
		'сад часы река шарф огонь песок птица зеркало хлеб лестница дождь музыка корабль снег трава звезда чашка лес ' +
		'дверь лето камень ветер город свеча остров бумага луна мяч поле улица утро врач экзамен работа деньги здоровье ошибка'
	).split(' ');
	const END = 'Упражнение закончено. Можно возвращаться к своим делам.';
	// «Белый медведь» (этап 4): минуту подавляем мысль, минуту не мешаем ей — и сравниваем
	const BEAR1 =
		'Минуту изо всех сил старайтесь не думать о белом медведе — или о своей тревожной мысли. Каждый раз, когда она всё же придёт, нажмите кнопку.';
	const BEAR2 = 'Теперь минуту не мешайте: пусть мысль приходит и уходит, как хочет. Так же нажимайте кнопку, когда она появится.';
	const times = (n) => `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'раза' : 'раз'}`;
	let bearPart = $state(1);
	let counts = $state([0, 0]);
	const bearNote = $derived(
		`Когда подавлял — мысль пришла ${times(counts[0])}, когда не мешал — ${times(counts[1])}.`
	);
	const available = $derived(Object.entries(EXERCISES).filter(([, ex]) => (ex.fromStage ?? 2) <= data.stage));

	let exercise = $state('train');
	let minutes = $state(2);
	let voiceOn = $state(true);
	let phase = $state('setup'); // setup | running | done
	let shown = $state('');
	let startedAt = 0;
	let nowMs = $state(0);
	let usedMin = $state(1);
	let runId = 0;
	let timer;
	const voice = createVoice();

	const left = $derived(Math.max(0, minutes * 60 - Math.floor((nowMs - startedAt) / 1000)));
	const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

	function shuffle(a) {
		const r = [...a];
		for (let i = r.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[r[i], r[j]] = [r[j], r[i]];
		}
		return r;
	}

	async function speak(text) {
		shown = text;
		if (!voiceOn) return sleep(Math.min(6000, 1500 + text.length * 50));
		try {
			await voice.say(text, readSpeaker());
		} catch {
			voiceOn = false; // голос недоступен — продолжаем текстом
		}
	}

	function start() {
		voice.unlock(); // по нажатию — иначе iPhone не даст звук
		const id = ++runId;
		if (exercise === 'bear') {
			minutes = 2;
			bearPart = 1;
			counts = [0, 0];
		}
		startedAt = Date.now();
		nowMs = startedAt;
		phase = 'running';
		timer = setInterval(() => (nowMs = Date.now()), 500);
		run(id);
	}

	async function run(id) {
		const speaker = readSpeaker();
		const live = () => id === runId && phase === 'running';
		const timeLeft = () => minutes * 60_000 - (Date.now() - startedAt);
		if (exercise === 'bear') {
			await speak(BEAR1);
			startedAt = Date.now(); // отсчёт — после инструкции
			while (live() && timeLeft() > 60_000) await sleep(300);
			if (!live()) return;
			await voice.chime();
			bearPart = 2;
			await speak(BEAR2);
			startedAt = Date.now() - 60_000;
		} else await speak(INTRO[exercise]);
		if (exercise === 'bear') {
			/* вторая минута — просто ждём */
		} else if (exercise === 'assoc') {
			const words = shuffle(WORDS);
			for (let i = 0; live() && timeLeft() > 4000; i++) {
				const w = words[i % words.length];
				if (voiceOn) voice.preload(words[(i + 1) % words.length], speaker);
				await speak(w);
				await sleep(4500);
			}
		} else {
			for (let i = 0; live() && timeLeft() > 8000; i++) {
				await sleep(Math.min(25_000, Math.max(0, timeLeft() - 6000)));
				if (!live() || timeLeft() <= 6000) break;
				await speak(TRAIN_PROMPTS[i % TRAIN_PROMPTS.length]);
			}
		}
		while (live() && timeLeft() > 0) await sleep(300);
		if (id !== runId) return;
		finish(true);
		await voice.chime();
		await speak(END);
	}

	function finish(full) {
		clearInterval(timer);
		usedMin = full ? minutes : Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
		phase = 'done';
	}

	function stopEarly() {
		runId++;
		voice.stop();
		finish(false);
	}

	onDestroy(() => {
		runId++;
		voice.stop();
		clearInterval(timer);
	});
</script>

{#if form?.saved}
	<div class="card">
		<p class="done">Записано в дневник.</p>
		<p><a href="/" class="btn big">На главную</a> <a href="/exercises" class="btn secondary" data-sveltekit-reload>Ещё раз</a></p>
	</div>
{:else if phase === 'setup'}
	<p class="muted small">Пара минут в день. Сегодня упражнений: {data.today}.</p>
	<div class="card">
		{#each available as [id, ex]}
			<label class="inline option">
				<input type="radio" name="ex" value={id} bind:group={exercise} />
				<span><b>{ex.label}.</b> <span class="muted">{ex.hint}</span></span>
			</label>
		{/each}
		{#if exercise !== 'bear'}
			<label for="len">Длительность</label>
			<select id="len" bind:value={minutes} style="width: auto">
				<option value={2}>2 минуты</option>
				<option value={3}>3 минуты</option>
				<option value={5}>5 минут</option>
			</select>
		{:else}
			<p class="small muted">Две минуты: минута подавления и минута «не мешать».</p>
		{/if}
		<label class="inline"><input type="checkbox" bind:checked={voiceOn} /> Озвучивать (голос из «Разговора»)</label>
		<p><button type="button" class="big" onclick={start}>Начать</button></p>
	</div>
{:else}
	<div class="card stage">
		{#if exercise === 'train' && phase === 'running'}
			<div class="track" aria-hidden="true"><div class="train"><i></i><i></i><i></i><i></i></div></div>
		{/if}
		<p class={exercise === 'assoc' && shown.split(' ').length === 1 ? 'word' : 'phrase'}>{shown}</p>
		{#if phase === 'running' && exercise === 'bear'}
			<p class="small muted">{bearPart === 1 ? 'Минута 1: не думать' : 'Минута 2: не мешать'}</p>
			<button type="button" class="big" onclick={() => counts[bearPart - 1]++}>Мысль пришла · {counts[bearPart - 1]}</button>
		{/if}
		{#if phase === 'running'}
			<p class="muted small">{mmss(left)}</p>
			<button type="button" class="secondary" onclick={stopEarly}>Закончить</button>
		{/if}
	</div>

	{#if phase === 'done'}
		<form method="POST" class="card" use:enhance>
			<input type="hidden" name="exercise" value={exercise} />
			<input type="hidden" name="minutes" value={usedMin} />
			<label for="note">Что заметили (по желанию)</label>
			{#if exercise === 'bear'}
				<p>{bearNote}</p>
				<p class="small muted">Обычно, когда мысль гонят, она возвращается чаще. Подавление не помогает — а если не мешать, мысль уходит сама.</p>
				<textarea id="note" name="note">{bearNote}</textarea>
			{:else}
				<textarea id="note" name="note" placeholder="Например: несколько раз «садился в вагон», но получалось вернуться"></textarea>
			{/if}
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<p><button type="submit" class="big">Сохранить ({usedMin} мин)</button></p>
		</form>
	{/if}
{/if}

<style>
	.option {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		margin-bottom: 10px;
	}
	.stage {
		text-align: center;
		min-height: 220px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 8px;
	}
	.word {
		font-size: 2.4rem;
		font-weight: 600;
		margin: 16px 0;
	}
	.phrase {
		font-size: 1.15rem;
		max-width: 32em;
	}
	.track {
		width: 100%;
		height: 34px;
		overflow: hidden;
		position: relative;
		border-bottom: 2px solid var(--line);
	}
	.train {
		position: absolute;
		top: 4px;
		display: flex;
		gap: 6px;
		animation: ride 9s linear infinite;
	}
	.train i {
		display: block;
		width: 46px;
		height: 24px;
		border-radius: 5px;
		background: var(--accent);
		opacity: 0.55;
	}
	@keyframes ride {
		from {
			transform: translateX(-240px);
		}
		to {
			transform: translateX(110vw);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.train {
			animation: none;
		}
	}
</style>
