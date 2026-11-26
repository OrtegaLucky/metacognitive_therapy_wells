<script>
	import { JOURNAL_KINDS, EXERCISES, fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
	let kind = $state(data.newKind);
	$effect(() => {
		kind = data.newKind;
	});

	function summary(e) {
		const p = e.payload;
		const parts = [];
		if (e.kind === 'trigger') parts.push(p.postponed ? 'отложил' : 'не получилось отложить');
		if (e.kind === 'worry_window') {
			parts.push(p.wanted_to_worry ? 'захотелось беспокоиться' : 'желания не было');
			if (p.minutes_used != null) parts.push(`${p.minutes_used} мин`);
		}
		if (e.kind === 'att' && p.exercise) parts.push(EXERCISES[p.exercise]?.label ?? p.exercise);
		if (e.kind === 'att' && p.minutes != null) parts.push(`${p.minutes} мин`);
		return parts.join(', ');
	}
</script>

<h1>Дневник</h1>

<form method="POST" action="?/add" class="card">
	<input type="hidden" name="back" value={data.back} />
	<label for="kind">Что записать</label>
	<select id="kind" name="kind" bind:value={kind}>
		{#each data.enabled as k}<option value={k}>{JOURNAL_KINDS[k]}</option>{/each}
	</select>

	{#if kind === 'trigger'}
		<label>Получилось отложить беспокойство на вечер?</label>
		<label class="inline"><input type="radio" name="postponed" value="yes" checked /> Да</label>
		<label class="inline"><input type="radio" name="postponed" value="no" /> Нет</label>
	{:else if kind === 'worry_window'}
		<label>Захотелось ли вечером беспокоиться?</label>
		<label class="inline"><input type="radio" name="wanted_to_worry" value="yes" /> Да</label>
		<label class="inline"><input type="radio" name="wanted_to_worry" value="no" checked /> Нет</label>
		<label for="minutes_used">Сколько минут потратили</label>
		<input id="minutes_used" name="minutes_used" type="number" min="0" max="120" class="short" inputmode="numeric" />
	{:else if kind === 'att'}
		<label for="minutes">Сколько минут</label>
		<input id="minutes" name="minutes" type="number" min="0" max="120" value="12" class="short" inputmode="numeric" />
	{/if}

	{#if kind !== 'att'}
		<label for="note">{kind === 'trigger' ? 'Какая мысль (коротко, по желанию)' : 'Заметка'}</label>
		<textarea id="note" name="note" required={kind === 'free'}></textarea>
	{/if}

	{#if form?.error}<p class="error">{form.error}</p>{/if}
	<p><button type="submit" class="big">Сохранить</button></p>
	{#if data.added}<p class="done">Записано.</p>{/if}
</form>

<form method="GET" class="row">
	<select name="kind" style="flex: 1">
		<option value="">Все типы</option>
		{#each Object.entries(JOURNAL_KINDS) as [k, label]}
			<option value={k} selected={data.filter.kind === k}>{label}</option>
		{/each}
	</select>
	<input name="stage" type="number" min="1" max="11" placeholder="Этап" class="short" value={data.filter.stage ?? ''} />
	<button type="submit" class="secondary">Показать</button>
</form>

{#each data.entries as e (e.id)}
	<div class="card">
		<div class="row small muted">
			<span>{fmtDate(e.created_at)}</span>
			<span>· этап {e.stage}</span>
			<span>· {JOURNAL_KINDS[e.kind]}</span>
		</div>
		{#if summary(e)}<div>{summary(e)}</div>{/if}
		{#if e.payload.note}<div style="white-space: pre-wrap">{e.payload.note}</div>{/if}
		<form method="POST" action="?/delete">
			<input type="hidden" name="id" value={e.id} />
			<button type="submit" class="link small">удалить</button>
		</form>
	</div>
{:else}
	<p class="muted">Записей пока нет.</p>
{/each}
