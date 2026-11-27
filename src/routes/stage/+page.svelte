<script>
	import { onDestroy } from 'svelte';
	import { fmtDate } from '$lib/labels.js';
	import { EXPERIMENT_KINDS } from '$lib/experiments.js';
	import { createVoice, readSpeaker } from '$lib/speak.js';

	let { data, form } = $props();
	const n = $derived(data.profile.current_stage);
	const b = $derived(data.blocks);

	// Озвучка описания этапа: по кускам, следующий кусок готовится, пока звучит текущий
	const voice = createVoice();
	let reading = $state(false);
	let readError = $state('');
	let runId = 0;
	async function read() {
		if (reading) return stopRead();
		voice.unlock(); // по нажатию — иначе iPhone не даст звук
		readError = '';
		reading = true;
		const id = ++runId;
		const sp = readSpeaker();
		try {
			for (let i = 0; i < data.speech.length && id === runId; i++) {
				if (data.speech[i + 1]) voice.preload(data.speech[i + 1], sp);
				await voice.say(data.speech[i], sp);
			}
		} catch (e) {
			readError = 'Не получилось озвучить: ' + (e?.message ?? e);
		}
		if (id === runId) reading = false;
	}
	function stopRead() {
		runId++;
		voice.stop();
		reading = false;
	}
	onDestroy(stopRead);
</script>

<p class="muted small">Этап {n} из 11 · день {data.days + 1}</p>
<h1>{data.stage?.title ?? 'Этап'}</h1>

<!-- 1. Чтение -->
<section class="card">
	<h2 class="block"><span class="num">1</span> Что за этап</h2>
	{#if data.stage?.goal}<p><b>Цель:</b> {data.stage.goal}</p>{/if}
	{#if data.stage?.duration}<p><b>Срок:</b> {data.stage.duration}</p>{/if}
	{#if data.stage?.outcome}<p><b>К чему прийти:</b> {data.stage.outcome}</p>{/if}
	{#if data.stage?.tasks?.length}
		<p style="margin-bottom: 4px"><b>Что сделать:</b></p>
		<ul class="tasks">
			{#each data.stage.tasks as t}<li>{t}</li>{/each}
		</ul>
	{/if}
	{#if data.speech.length}
		<p>
			<button type="button" class="secondary" onclick={read}>{reading ? '■ Остановить' : '▶ Озвучить описание'}</button>
		</p>
		{#if readError}<p class="error small">{readError}</p>{/if}
	{/if}
	{#if data.html}
		<details>
			<summary><b>Полное описание этапа</b></summary>
			<!-- Тексты этапов — свои файлы из content/, не пользовательский ввод -->
			<div class="text">{@html data.html}</div>
		</details>
	{/if}
</section>

<!-- 2. Упражнения этапа -->
<section class="card">
	<h2 class="block"><span class="num">2</span> Упражнения этапа</h2>
	{#if b.toolsStage.length}
		<ul class="links">
			{#each b.toolsStage as t}<li><a href={t.href}>{t.label}</a> <span class="tag new">этап {n}</span></li>{/each}
		</ul>
	{:else}
		<p class="muted small">Новых упражнений на этом этапе нет — продолжаются упражнения курса (блок 4).</p>
	{/if}
</section>

<!-- 3. Эксперименты этапа -->
<section class="card">
	<h2 class="block"><span class="num">3</span> Эксперименты этапа</h2>
	{#if b.expStage.length}
		<ul class="links">
			{#each b.expStage as k}
				<li>
					<a href="/experiments">{EXPERIMENT_KINDS[k].label}</a> <span class="tag new">этап {n}</span>
					<span class="small muted"> · завершено на этапе: {data.expDone[k] ?? 0}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted small">На этом этапе своих экспериментов нет.</p>
	{/if}
</section>

<!-- 4–5. Весь курс -->
{#if b.toolsCourse.length || b.expCourse.length}
	<section class="card">
		<h2 class="block"><span class="num">4</span> Упражнения всего курса</h2>
		{#if b.toolsCourse.length}
			<ul class="links">
				{#each b.toolsCourse as t}<li><a href={t.href}>{t.label}</a> <span class="tag">с этапа {t.fromStage}</span></li>{/each}
			</ul>
		{:else}
			<p class="muted small">Появятся со следующего этапа.</p>
		{/if}
		<h2 class="block"><span class="num">5</span> Эксперименты всего курса</h2>
		<ul class="links">
			{#each b.expCourse as k}
				<li><a href="/experiments">{EXPERIMENT_KINDS[k].label}</a> <span class="tag">{k === 'custom' ? 'всегда' : 'можно повторить'}</span></li>
			{/each}
		</ul>
	</section>
{/if}

<!-- 6. Фиксация результата -->
{#if !data.isLast}
	<section class="card">
		<h2 class="block"><span class="num">6</span> Итог этапа и переход</h2>
		{#if data.unlock.hasRule}
			<ul class="checks">
				{#each data.unlock.items as item}
					<li class:done={item.done}>
						{item.done ? '✓' : '○'}
						{#if item.link && !item.done}<a href={item.link}>{item.label}</a>{:else}{item.label}{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if data.review}
			<div class="summary">
				<p class="small muted" style="margin: 0">Ваш итог этапа · {fmtDate(data.review.saved_at)}</p>
				<p><b>Понял:</b> {data.review.learned}</p>
				{#if data.review.still_hard}<p><b>Трудно:</b> {data.review.still_hard}</p>{/if}
				{#if data.review.next_focus}<p><b>Дальше:</b> {data.review.next_focus}</p>{/if}
			</div>
		{:else if data.unlock.items?.some((i) => i.link === '/review')}
			<p><a class="btn secondary" href="/review">Разбор этапа с моделью</a></p>
		{/if}
		{#if data.unlock.ok}
			<form method="POST" action="?/advance">
				<button type="submit" class="big">Перейти на этап {n + 1}</button>
			</form>
		{:else if data.unlock.hasRule}
			<p class="muted small">Переход откроется, когда все пункты будут отмечены.</p>
		{/if}

		<details style="margin-top: 12px">
			<summary class="muted small">Перейти вручную</summary>
			<form method="POST" action="?/force">
				<label class="inline"><input type="checkbox" name="confirm" value="yes" /> Понимаю, что перехожу без выполнения условий</label>
				<p><button type="submit" class="danger">Перейти вручную</button></p>
			</form>
		</details>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
	</section>
{/if}

<details class="card">
	<summary><b>Маршрут программы</b></summary>
	<ol>
		{#each data.route as s}
			<li class:muted={s.number > n}>
				{#if s.number === n}<b>{s.title}</b> — сейчас{:else}{s.title}{/if}
			</li>
		{/each}
	</ol>
	<p class="small muted" style="margin-bottom: 0">История:</p>
	<ul class="small">
		{#each data.history as h}
			<li>Этап {h.stage}: с {fmtDate(h.started_at)}{h.manual ? ' (вручную)' : ''}</li>
		{/each}
	</ul>
</details>

<style>
	.block {
		margin-top: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.block:not(:first-child) {
		margin-top: 1.2rem;
	}
	.num {
		display: inline-grid;
		place-items: center;
		width: 1.6em;
		height: 1.6em;
		border-radius: 50%;
		background: var(--accent);
		color: var(--bg);
		font-size: 0.8em;
	}
	.links,
	.tasks {
		padding-left: 20px;
		margin: 4px 0;
		line-height: 1.6;
	}
	.tag {
		font-size: 0.75rem;
		padding: 1px 7px;
		border-radius: 10px;
		border: 1px solid var(--line);
		color: var(--muted, inherit);
		white-space: nowrap;
	}
	.tag.new {
		border-color: var(--accent);
		color: var(--accent);
	}
	.summary {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 8px 12px;
		margin: 10px 0;
	}
	.text {
		margin-top: 8px;
	}
	summary {
		cursor: pointer;
	}
</style>
