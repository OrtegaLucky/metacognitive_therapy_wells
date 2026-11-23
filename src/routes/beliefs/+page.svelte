<script>
	import { RATING_CONTEXT, fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
</script>

<h1>Убеждения о беспокойстве</h1>
<p class="muted">Насколько вы верите в каждое прямо сейчас, от 0 до 100%. Главная цель метода — чтобы эти цифры снижались.</p>
{#if form?.error}<p class="error">{form.error}</p>{/if}

{#each data.groups as g}
	<h2>{g.label}</h2>
	{#each g.items as b (b.id)}
		<div class="card">
			<div style="white-space: pre-wrap">{b.text}</div>
			<div class="row" style="margin-top: 8px">
				<b style="font-size: 1.3rem">{b.current ?? '—'}%</b>
				<form method="POST" action="?/rate" class="row">
					<input type="hidden" name="id" value={b.id} />
					<input name="percent" type="number" min="0" max="100" class="short" inputmode="numeric" required aria-label="Новая оценка" />
					<button type="submit" class="secondary">Оценить</button>
				</form>
			</div>
			{#if b.history.length > 1}
				<p class="small muted">
					{#each b.history as r, i}{i ? ' → ' : ''}<span title="{fmtDate(r.rated_at)}, {RATING_CONTEXT[r.context]}">{r.percent}%</span>{/each}
				</p>
			{/if}
			<form method="POST" action="?/archive">
				<input type="hidden" name="id" value={b.id} />
				<button type="submit" class="link small">убрать в архив</button>
			</form>
		</div>
	{/each}

	<details class="card" open={!g.items.length || form?.type === g.id}>
		<summary>Добавить убеждение «{g.label}»</summary>
		<form method="POST" action="?/add">
			<input type="hidden" name="type" value={g.id} />
			<label for="text-{g.id}">Формулировка своими словами</label>
			<textarea id="text-{g.id}" name="text" placeholder={g.hint} required></textarea>
			<label for="p-{g.id}">Насколько верите сейчас, %</label>
			<input id="p-{g.id}" name="percent" type="number" min="0" max="100" class="short" inputmode="numeric" required />
			<p><button type="submit">Добавить</button></p>
		</form>
	</details>
{/each}
