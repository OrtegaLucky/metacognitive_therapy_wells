<script>
	import { JOURNAL_KINDS } from '$lib/labels.js';

	let { data } = $props();
	// У этих записей свои экраны или быстрая кнопка — остальные отмечаются через дневник
	const SPECIAL = ['free', 'trigger', 'worry_window', 'att', 'problem'];
	const quick = $derived(data.enabled.filter((k) => !SPECIAL.includes(k)));
	const done = $derived(data.steps.filter((i) => i.done).length);
	const left = $derived(data.steps.filter((i) => !i.done));
</script>

<p class="muted small" style="margin-bottom: 0">
	<a href="/stage">Этап {data.n} из 11</a> · день {data.days} · {data.title}
</p>

{#if data.n === 11}
	<div class="card">
		<h2 style="margin-top: 0">Еженедельная проверка</h2>
		<p class="small muted">{data.lastReview > 0 ? `Последний разбор: ${data.lastReview} дн. назад.` : 'Разбор недели — раз в неделю.'}</p>
		<div class="grid">
			<a class="btn secondary" href="/scales">GAD-7</a>
			<a class="btn secondary" href="/beliefs">Переоценить убеждения</a>
			<a class="btn" href="/review">Разбор недели</a>
		</div>
	</div>
{/if}

{#if data.enabled.includes('trigger')}
	<form method="POST" action="/diary?/add" class="card trigger">
		<input type="hidden" name="kind" value="trigger" />
		<input type="hidden" name="back" value="/?logged=1" />
		<h2 style="margin-top: 0">Заметил триггер?</h2>
		<p class="muted small">Скажите себе: «Подумаю об этом вечером» — и отметьте.</p>
		<details>
			<summary class="small">Записать мысль (по желанию)</summary>
			<input name="note" maxlength="300" placeholder="Например: а вдруг не успею с отчётом" />
		</details>
		<div class="grid" style="margin-top: 8px">
			<button type="submit" name="postponed" value="yes" class="big">Отложил на вечер</button>
			<button type="submit" name="postponed" value="no" class="big secondary">Не получилось</button>
		</div>
		{#if data.logged}<p class="done">Записано. Возвращайтесь к своим делам.</p>
		{:else if data.today.trigger}<p class="small muted">Сегодня отмечено: {data.today.trigger}</p>{/if}
	</form>
{/if}

{#if data.todo.length}
	<h2>Сделать сегодня</h2>
	<ul class="todo">
		{#each data.todo as item}
			<li class:ok={item.done}>
				<a href={item.href}>
					<span class="mark">{item.done ? '✓' : '○'}</span>
					<span class="txt">{item.label}<small>{item.sub}</small></span>
					<span class="go">›</span>
				</a>
			</li>
		{/each}
	</ul>
{:else if left.length}
	<h2>Задания этапа</h2>
	<ul class="todo">
		{#each left as item}
			<li>
				<a href={item.link ?? '/stage'}>
					<span class="mark">○</span>
					<span class="txt">{item.label}</span>
					<span class="go">›</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

{#if quick.length}
	<p class="small">
		Ещё можно отметить:
		{#each quick as kind, i}{i ? ' · ' : ''}<a href="/diary?new={kind}&back=/">{JOURNAL_KINDS[kind]}</a>{#if data.today[kind]} ({data.today[kind]}){/if}{/each}
	</p>
{/if}

{#if data.hasRule && data.n < 11}
	<a class="card progress" href="/stage">
		<div class="row-sp">
			<b>До перехода на этап {data.n + 1}</b>
			<span class="small">{done} из {data.steps.length}</span>
		</div>
		<div class="track"><div class="fill" style="width: {(done / data.steps.length) * 100}%"></div></div>
		<span class="small muted">
			{data.unlockOk ? 'Всё выполнено — можно переходить. Открыть «Мой этап» ›' : 'Что осталось — в «Мой этап» ›'}
		</span>
	</a>
{/if}

<style>
	.todo {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		display: grid;
		gap: 6px;
	}
	.todo a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--card);
		text-decoration: none;
		color: var(--text);
	}
	.todo .mark {
		font-size: 1.2rem;
		width: 1.2em;
		text-align: center;
		color: var(--accent);
	}
	.todo .txt {
		flex: 1;
	}
	.todo small {
		display: block;
		font-size: 0.85rem;
		opacity: 0.65;
	}
	.todo .go {
		opacity: 0.4;
		font-size: 1.3rem;
	}
	.todo li.ok a {
		opacity: 0.55;
	}
	.progress {
		display: block;
		text-decoration: none;
		color: var(--text);
	}
	.row-sp {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.track {
		height: 8px;
		border-radius: 4px;
		background: var(--line);
		overflow: hidden;
		margin: 8px 0 6px;
	}
	.fill {
		height: 100%;
		background: var(--accent);
		border-radius: 4px;
	}
</style>
