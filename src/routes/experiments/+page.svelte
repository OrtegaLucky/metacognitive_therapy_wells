<script>
	import { enhance } from '$app/forms';
	import { EXPERIMENT_KINDS } from '$lib/experiments.js';
	import GuidedRun from '$lib/GuidedRun.svelte';
	import { BELIEF_LABEL, fmtDate } from '$lib/labels.js';

	let { data, form } = $props();

	let kind = $state(data.kinds[0]);
	let beliefId = $state('');
	const k = $derived(EXPERIMENT_KINDS[kind]);
	// Убеждения подходящего типа — первыми
	const beliefOptions = $derived(
		[...data.beliefs].sort((a, b) => (b.type === k?.belief) - (a.type === k?.belief))
	);
	const chosen = $derived(data.beliefs.find((b) => String(b.id) === String(beliefId)));
	const open = $derived(data.experiments.filter((e) => !e.completed_at));
	const done = $derived(data.experiments.filter((e) => e.completed_at));

	let pending = $state(null); // какая кнопка сейчас ждёт ответа

	const withPending = (name) => () => {
		pending = name;
		return async ({ update }) => {
			await update({ reset: false });
			pending = null;
		};
	};
	const errFor = (id) => (form?.error && form?.id === id ? form.error : '');
</script>

<h1>Эксперименты</h1>
<p class="muted small">
	Проверка убеждений о беспокойстве на опыте. Сначала прогноз — что, по-вашему, случится. Потом эксперимент, результат и
	ваш собственный вывод. Модель только задаёт вопросы, вывод пишете вы.
</p>

<details class="card" open={!data.experiments.length}>
	<summary><b>Новый эксперимент</b></summary>
	<form method="POST" action="?/create" use:enhance={withPending('create')}>
		<label for="kind">Вид</label>
		<select id="kind" name="kind" bind:value={kind}>
			{#each data.kinds as id}<option value={id}>{EXPERIMENT_KINDS[id].label}</option>{/each}
		</select>
		<p class="small muted">{k?.how}</p>
		{#if data.kinds.length === 1}
			<p class="small muted">Готовые эксперименты откроются с этапа 3. Пока можно придумать свой.</p>
		{/if}

		<label for="belief">Какое убеждение проверяем</label>
		<select id="belief" name="belief_id" bind:value={beliefId}>
			<option value="">— не выбрано —</option>
			{#each beliefOptions as b}
				<option value={b.id}>{BELIEF_LABEL[b.type]}: {b.text}{b.current != null ? ` (${b.current}%)` : ''}</option>
			{/each}
		</select>
		{#if !data.beliefs.length}<p class="small muted">Убеждений пока нет — их можно выписать на экране <a href="/beliefs">«Убеждения»</a> или через <a href="/talk">разговор</a>.</p>{/if}

		<label for="prediction">Прогноз: что, по-вашему, случится?</label>
		<textarea id="prediction" name="prediction" placeholder={k?.predictionHint}></textarea>

		<div class="row">
			<label class="inline small">Уверен в прогнозе на <input type="number" name="prediction_percent" min="0" max="100" style="width: 80px" /> %</label>
			<label class="inline small">
				Верю в убеждение сейчас на
				<input type="number" name="belief_before_percent" min="0" max="100" style="width: 80px" value={chosen?.current ?? ''} /> %
			</label>
		</div>
		<p><button type="submit" class="big" disabled={pending === 'create'}>Записать прогноз</button></p>
		{#if form?.error && form?.id == null}<p class="error">{form.error}</p>{/if}
	</form>
</details>

{#each open as e (e.id)}
	<div class="card">
		<p class="small muted">{fmtDate(e.created_at)} · этап {e.stage}</p>
		<h2>{EXPERIMENT_KINDS[e.kind]?.label ?? e.kind}</h2>
		{#if e.belief_text}<p class="small"><b>Убеждение:</b> {e.belief_text}{e.belief_before_percent != null ? ` — верю на ${e.belief_before_percent}%` : ''}</p>{/if}
		<p class="small"><b>Прогноз:</b> {e.prediction}{e.prediction_percent != null ? ` (уверен на ${e.prediction_percent}%)` : ''}</p>
		<p class="small muted">{EXPERIMENT_KINDS[e.kind]?.how}</p>
		{#if e.kind === 'amplify_release' || e.kind === 'lose_control'}<GuidedRun kind={e.kind} id={e.id} />{/if}

		<form method="POST" use:enhance={withPending(e.id)}>
			<input type="hidden" name="id" value={e.id} />
			<label for="did{e.id}">Что я сделал</label>
			<textarea id="did{e.id}" name="what_i_did">{e.what_i_did ?? ''}</textarea>
			<label for="hap{e.id}">Что произошло на самом деле</label>
			<textarea id="hap{e.id}" name="what_happened">{e.what_happened ?? ''}</textarea>
			<div class="row">
				<button type="submit" formaction="?/result" class="secondary" disabled={pending === e.id}>Сохранить</button>
				<button type="submit" formaction="?/questions" disabled={pending === e.id}>
					{pending === e.id ? 'Думаю…' : e.gpt_questions ? 'Другие вопросы' : 'Вопросы к результату'}
				</button>
			</div>

			{#if e.gpt_questions}
				<div class="questions">
					<ol>
						{#each e.gpt_questions.questions as q}<li>{q}</li>{/each}
					</ol>
					<p class="small muted">{e.gpt_questions.label} · {(e.gpt_questions.ms / 1000).toFixed(1).replace('.', ',')} с</p>
				</div>
			{/if}

			<label for="con{e.id}">Мой вывод</label>
			<textarea id="con{e.id}" name="conclusion" placeholder="Что этот опыт говорит о моём убеждении?"></textarea>
			<label class="inline small">
				Теперь верю в убеждение на <input type="number" name="belief_after_percent" min="0" max="100" style="width: 80px" /> %
			</label>
			<p><button type="submit" formaction="?/complete" class="big" disabled={pending === e.id}>Завершить эксперимент</button></p>
			{#if errFor(e.id)}<p class="error">{errFor(e.id)}</p>{/if}
		</form>
		<form method="POST" action="?/remove" use:enhance onsubmit={(ev) => confirm('Удалить этот незавершённый эксперимент?') || ev.preventDefault()}>
			<input type="hidden" name="id" value={e.id} />
			<button type="submit" class="link small">Удалить</button>
		</form>
	</div>
{/each}

{#if done.length}
	<h2>Завершённые</h2>
	{#each done as e (e.id)}
		<details class="card">
			<summary>
				<b>{EXPERIMENT_KINDS[e.kind]?.label ?? e.kind}</b> · {fmtDate(e.completed_at)}
				{#if e.belief_before_percent != null || e.belief_after_percent != null}
					· вера в убеждение {e.belief_before_percent ?? '—'}% → <b>{e.belief_after_percent ?? '—'}%</b>
				{/if}
			</summary>
			{#if e.belief_text}<p class="small"><b>Убеждение:</b> {e.belief_text}</p>{/if}
			<p class="small"><b>Прогноз:</b> {e.prediction}{e.prediction_percent != null ? ` (уверен на ${e.prediction_percent}%)` : ''}</p>
			{#if e.what_i_did}<p class="small"><b>Что сделал:</b> {e.what_i_did}</p>{/if}
			<p class="small"><b>Что произошло:</b> {e.what_happened}</p>
			{#if e.gpt_questions}
				<p class="small"><b>Вопросы:</b></p>
				<ol class="small">{#each e.gpt_questions.questions as q}<li>{q}</li>{/each}</ol>
			{/if}
			<p class="small"><b>Мой вывод:</b> {e.conclusion}</p>
		</details>
	{/each}
{/if}

<style>
	.questions {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 8px 12px;
		margin: 12px 0;
	}
	.questions ol {
		margin: 4px 0;
		padding-left: 20px;
		line-height: 1.5;
	}
	summary {
		cursor: pointer;
	}
</style>
