<script>
	// Пошаговый проход эксперимента с таймером (этапы 3–5).
	// amplify_release: 2 минуты усиливаем беспокойство → отпускаем, засекаем, за сколько отпустило.
	// lose_control: 5–15 минут беспокоимся изо всех сил → отмечаем, случилось ли то, чего боялись.
	// В конце дописывает итог в поля «Что я сделал» и «Что произошло» карточки эксперимента.
	import { onDestroy } from 'svelte';
	import { createVoice, sleep, readSpeaker } from '$lib/speak.js';

	let { kind, id } = $props();

	const PLAN = {
		amplify_release: {
			start: 'Вспомните, о чём вы обычно беспокоитесь. Две минуты специально беспокойтесь об этом как можно сильнее — прокручивайте, усиливайте.',
			push: ['Ещё сильнее. Представьте самое плохое.', 'Не сдерживайтесь — попробуйте разогнать беспокойство.', 'Продолжайте, сильнее.'],
			release: 'Достаточно. Теперь отпустите эти мысли: скажите себе «подумаю вечером» и переключитесь на то, что вокруг. Нажмите кнопку, когда беспокойство стихнет.'
		},
		lose_control: {
			start: 'Беспокойтесь изо всех сил. Попробуйте довести себя до того, чего боитесь: потерять контроль, сойти с ума, навредить себе беспокойством.',
			push: ['Сильнее. Попробуйте по-настоящему потерять контроль.', 'Не сдерживайтесь. Что происходит с вами на самом деле?', 'Продолжайте беспокоиться изо всех сил.'],
			release: null
		}
	};
	const plan = PLAN[kind];

	let step = $state('idle'); // idle | push | release | ask | done
	let minutes = $state(kind === 'lose_control' ? 10 : 2);
	let voiceOn = $state(true);
	let shown = $state('');
	let left = $state(0);
	let releaseSec = $state(0);
	let runId = 0;
	const voice = createVoice();
	const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

	async function speak(text) {
		shown = text;
		if (!voiceOn) return;
		try {
			await voice.say(text, readSpeaker());
		} catch {
			voiceOn = false;
		}
	}

	async function run() {
		voice.unlock();
		const my = ++runId;
		const live = () => my === runId;
		step = 'push';
		await speak(plan.start);
		const end = Date.now() + minutes * 60_000;
		let nextPush = Date.now() + 40_000;
		for (let i = 0; live() && Date.now() < end; ) {
			left = Math.ceil((end - Date.now()) / 1000);
			if (Date.now() >= nextPush && end - Date.now() > 15_000) {
				await speak(plan.push[i++ % plan.push.length]);
				nextPush = Date.now() + 40_000;
			}
			await sleep(250);
		}
		if (!live()) return;
		left = 0;
		await voice.chime();
		if (plan.release) {
			step = 'release';
			const t0 = Date.now();
			const tick = setInterval(() => (releaseSec = Math.round((Date.now() - t0) / 1000)), 500);
			speak(plan.release);
			while (live() && step === 'release' && Date.now() - t0 < 5 * 60_000) await sleep(250);
			clearInterval(tick);
			releaseSec = Math.round((Date.now() - t0) / 1000);
			if (!live()) return;
		}
		step = 'ask';
	}

	function fill(did, happened) {
		const put = (fid, text) => {
			const el = document.getElementById(fid);
			if (!el) return;
			el.value = el.value.trim() ? el.value.trim() + '\n' + text : text;
			el.dispatchEvent(new Event('input', { bubbles: true }));
		};
		put('did' + id, did);
		put('hap' + id, happened);
		step = 'done';
	}

	function answer(a) {
		if (kind === 'amplify_release') {
			const r = { yes: 'получилось', part: 'получилось частично', no: 'не получилось' }[a];
			fill(
				`${minutes} мин специально усиливал беспокойство, потом отпустил.`,
				`Отпустить ${r}; беспокойство стихло примерно за ${releaseSec < 60 ? releaseSec + ' с' : Math.round(releaseSec / 60) + ' мин'}.`
			);
		} else {
			const r = { no: 'Ничего из того, чего боялся, не случилось.', part: 'Было неприятно, но контроль я не потерял.', yes: 'Мне показалось, что я теряю контроль.' }[a];
			fill(`${minutes} мин беспокоился изо всех сил, пытаясь потерять контроль.`, r);
		}
	}

	function cancel() {
		runId++;
		voice.stop();
		step = 'idle';
	}
	onDestroy(cancel);
</script>

<div class="guided">
	{#if step === 'idle'}
		<div class="row">
			{#if kind === 'lose_control'}
				<select bind:value={minutes} style="width: auto">
					<option value={5}>5 минут</option>
					<option value={10}>10 минут</option>
					<option value={15}>15 минут</option>
				</select>
			{/if}
			<label class="inline small"><input type="checkbox" bind:checked={voiceOn} /> голосом</label>
			<button type="button" onclick={run}>Пройти с таймером</button>
		</div>
	{:else if step === 'done'}
		<p class="small done">Итог записан в поля ниже — проверьте, допишите и сохраните.</p>
	{:else}
		<p>{shown}</p>
		{#if step === 'push'}
			<p class="clock">{mmss(left)}</p>
		{:else if step === 'release'}
			<p class="clock">{mmss(releaseSec)}</p>
			<button type="button" class="big" onclick={() => (step = 'ask')}>Беспокойство стихло</button>
		{:else if step === 'ask'}
			{#if kind === 'amplify_release'}
				<p><b>Получилось отпустить?</b></p>
				<div class="row">
					<button type="button" onclick={() => answer('yes')}>Да</button>
					<button type="button" class="secondary" onclick={() => answer('part')}>Частично</button>
					<button type="button" class="secondary" onclick={() => answer('no')}>Нет</button>
				</div>
			{:else}
				<p><b>Случилось то, чего вы боялись?</b></p>
				<div class="row">
					<button type="button" onclick={() => answer('no')}>Нет</button>
					<button type="button" class="secondary" onclick={() => answer('part')}>Было тяжело, но нет</button>
					<button type="button" class="secondary" onclick={() => answer('yes')}>Да</button>
				</div>
			{/if}
		{/if}
		{#if step !== 'ask'}<button type="button" class="link small" onclick={cancel}>Прервать</button>{/if}
	{/if}
</div>

<style>
	.guided {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 8px 12px;
		margin: 10px 0;
	}
	.clock {
		font-size: 2.2rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		margin: 4px 0;
	}
</style>
