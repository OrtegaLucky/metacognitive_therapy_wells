<script>
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { fmtDate } from '$lib/labels.js';
	import { createVoice } from '$lib/speak.js';

	let { data, form } = $props();

	const LENGTH = 15 * 60; // секунд
	const KEY = 'window.start';
	const voice = createVoice();

	let phase = $state('ask'); // ask | running | over
	let startedAt = $state(0);
	let nowMs = $state(Date.now());
	let note = $state('');
	let timer;

	// После окончания время замирает — пока пишете заметку, минуты не растут
	const elapsed = $derived(startedAt ? Math.min(LENGTH, Math.floor((nowMs - startedAt) / 1000)) : 0);
	const left = $derived(Math.max(0, LENGTH - elapsed));
	const minutesUsed = $derived(Math.min(120, Math.max(1, Math.ceil(elapsed / 60))));
	const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

	function tick() {
		if (phase !== 'running') return;
		nowMs = Date.now();
		if (phase === 'running' && elapsed >= LENGTH) {
			phase = 'over';
			voice.chime();
		}
	}

	onMount(() => {
		// Если страницу перезагрузили или телефон засыпал — продолжаем с того же места
		try {
			const s = Number(localStorage.getItem(KEY));
			if (s && Date.now() - s < 3 * 3600_000) {
				startedAt = s;
				phase = 'running';
				tick();
			}
		} catch {
			/* без запоминания */
		}
		timer = setInterval(tick, 1000);
	});
	onDestroy(() => clearInterval(timer));

	function start() {
		voice.unlock(); // по нажатию — чтобы в конце прозвучал сигнал
		startedAt = Date.now();
		nowMs = startedAt;
		phase = 'running';
		try {
			localStorage.setItem(KEY, String(startedAt));
		} catch {
			/* без запоминания */
		}
	}

	function finishEarly() {
		nowMs = Date.now();
		phase = 'over';
	}

	function clearStart() {
		try {
			localStorage.removeItem(KEY);
		} catch {
			/* нечего чистить */
		}
	}
</script>

{#if form?.saved}
	<div class="card">
		<p class="done">Окно отмечено.</p>
		{#if form.wanted}
			<p>Вы побеспокоились {form.minutes} мин в отведённое время — и остановились. Это и есть опыт: беспокойство можно отложить и можно закончить.</p>
		{:else}
			<p>Желания беспокоиться не было. Заметьте: то, что днём казалось срочным, к вечеру часто теряет силу.</p>
		{/if}
		<p><a href="/" class="btn big">На главную</a></p>
	</div>
{:else}
	<p class="muted small">
		Ваше окно — {data.time}{#if !data.timeSet} (можно поменять в <a href="/settings">настройках</a>){/if}.
	</p>

	<div class="card">
		<h2 style="margin-top: 0">Что вы откладывали</h2>
		{#if data.triggers.length}
			<ul>
				{#each data.triggers as t}
					<li>
						<span class="muted small">{fmtDate(t.created_at).slice(-5)}</span>
						{t.note || (t.postponed ? 'мысль без записи' : 'не получилось отложить')}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">За сутки отложенных мыслей не записано.</p>
		{/if}
	</div>

	{#if phase === 'ask'}
		<div class="card">
			{#if data.doneRecently}<p class="muted small">Сегодня окно уже отмечено — можно и ещё раз.</p>{/if}
			<p><b>Хочется ли сейчас беспокоиться об этом?</b></p>
			<p class="muted small">Беспокоиться в окне можно, но не обязательно.</p>
			<div class="grid">
				<button type="button" class="big" onclick={start}>Да, 15 минут</button>
				<form method="POST" use:enhance>
					<input type="hidden" name="wanted" value="no" />
					<input type="hidden" name="minutes" value="0" />
					<button type="submit" class="big secondary" style="width: 100%">Нет, желания нет</button>
				</form>
			</div>
		</div>
	{:else}
		<div class="card center">
			{#if phase === 'running'}
				<div class="clock">{mmss(left)}</div>
				<p class="muted small">Беспокойтесь сколько хочется — когда время выйдет, прозвучит сигнал. Если экран погаснет, таймер продолжит считать, но сигнала не будет.</p>
			{:else}
				<div class="clock">{left === 0 ? 'Время вышло' : 'Готово'}</div>
				<p>Остальное можно отложить до завтрашнего окна.</p>
			{/if}
		</div>

		<form method="POST" class="card" onsubmit={clearStart} use:enhance>
			<input type="hidden" name="wanted" value="yes" />
			<input type="hidden" name="minutes" value={minutesUsed} />
			<label for="note">О чём беспокоились (по желанию)</label>
			<textarea id="note" name="note" bind:value={note}></textarea>
			{#if form?.error}<p class="error">{form.error}</p>{/if}
			<p>
				{#if phase === 'running'}
					<button type="button" class="secondary" onclick={finishEarly}>Закончить раньше</button>
				{:else}
					<button type="submit" class="big">Сохранить ({minutesUsed} мин)</button>
				{/if}
			</p>
		</form>
	{/if}

	<p class="small">
		<a href="/reminder.ics" data-sveltekit-reload>Добавить ежедневное напоминание в календарь</a>
		<span class="muted"> — на iPhone откроется «Календарь», нажмите «Добавить».</span>
	</p>
{/if}

<style>
	.center {
		text-align: center;
	}
	.clock {
		font-size: 3rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		margin: 8px 0;
	}
</style>
