<script>
	import { enhance } from '$app/forms';
	import { RATING_CONTEXT, fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
	let asking = $state(null);
	const ask = (id) => () => {
		asking = id;
		return async ({ update }) => {
			await update({ reset: false });
			asking = null;
		};
	};
</script>

<h1>Убеждения о беспокойстве</h1>
<p class="muted">Насколько вы верите в каждое прямо сейчас, от 0 до 100%. Главная цель метода — чтобы эти цифры снижались.</p>
{#if form?.error && !form?.qid}<p class="error">{form.error}</p>{/if}

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

			{#if form?.qid === b.id && form?.questions}
				<div class="questions">
					<ol>{#each form.questions as q}<li>{q}</li>{/each}</ol>
					<p class="small muted">{form.label} · {(form.ms / 1000).toFixed(1).replace('.', ',')} с. Ответьте себе — можно записать в дневник.</p>
				</div>
			{/if}
			{#if form?.qid === b.id && form?.error}<p class="error">{form.error}</p>{/if}

			<div class="row">
				<form method="POST" action="?/questions" use:enhance={ask(b.id)}>
					<input type="hidden" name="id" value={b.id} />
					<button type="submit" class="link small" disabled={asking === b.id}>{asking === b.id ? 'Думаю…' : 'Вопросы к убеждению'}</button>
				</form>
				<form method="POST" action="?/archive">
					<input type="hidden" name="id" value={b.id} />
					<button type="submit" class="link small">убрать в архив</button>
				</form>
			</div>
			<details>
				<summary class="small muted">Перенести в другой тип</summary>
				<form method="POST" action="?/retype" class="row">
					<input type="hidden" name="id" value={b.id} />
					<select name="type" style="width: auto">
						{#each data.groups as t}<option value={t.id} selected={t.id === g.id}>{t.label}</option>{/each}
					</select>
					<button type="submit" class="secondary">Перенести</button>
				</form>
			</details>
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

<style>
	.questions {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 8px 12px;
		margin: 10px 0;
	}
	.questions ol {
		margin: 4px 0;
		padding-left: 20px;
		line-height: 1.5;
	}
</style>
