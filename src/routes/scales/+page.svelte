<script>
	import { GAD7_QUESTIONS, GAD7_OPTIONS, gad7Level, fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
</script>

<h1>GAD-7</h1>
<p class="muted">Как часто за последние 2 недели вас беспокоило следующее? Удобно проходить раз в неделю.</p>

<form method="POST" class="card">
	{#each GAD7_QUESTIONS as q, i}
		<fieldset style="border: none; padding: 0; margin: 0 0 14px">
			<legend><b>{i + 1}.</b> {q}</legend>
			{#each GAD7_OPTIONS as opt, v}
				<label class="inline"><input type="radio" name="q{i}" value={v} required /> {opt}</label>
			{/each}
		</fieldset>
	{/each}
	{#if form?.error}<p class="error">{form.error}</p>{/if}
	<button type="submit" class="big">Сохранить результат</button>
</form>

{#if data.results.length}
	<h2>Результаты</h2>
	<table>
		<thead><tr><th>Дата</th><th>Баллы</th><th>Уровень</th></tr></thead>
		<tbody>
			{#each data.results as r (r.id)}
				<tr><td>{fmtDate(r.taken_at)}</td><td>{r.total} из 21</td><td>{gad7Level(r.total)}</td></tr>
			{/each}
		</tbody>
	</table>
{/if}
<p class="small muted">Шкала показывает динамику и не является диагнозом.</p>
