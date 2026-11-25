<script>
	import { COPING, fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
</script>

<h1>Концептуализация</h1>
<p class="muted">Удобнее всего заполнить через <a href="/talk">разговор</a>, а здесь поправить вручную.</p>
<p class="muted">Карта вашего беспокойства. Вспомните недавний случай, когда сильно беспокоились, и опишите его по шагам. Можно возвращаться и дополнять.</p>

<form method="POST" class="card">
	<label for="trigger_examples">1. Что обычно запускает беспокойство?</label>
	<p class="small muted">Мысли «а вдруг…», ситуации, новости, ощущения в теле.</p>
	<textarea id="trigger_examples" name="trigger_examples">{data.f.trigger_examples ?? ''}</textarea>

	<label for="worry_chain">2. Как разворачивается беспокойство?</label>
	<p class="small muted">О чём думаете дальше, какие варианты прокручиваете, сколько это длится.</p>
	<textarea id="worry_chain" name="worry_chain">{data.f.worry_chain ?? ''}</textarea>

	<label for="type2_worry">3. Что пугает в самом беспокойстве?</label>
	<p class="small muted">Например: «не смогу остановиться», «это вредно», «я так сойду с ума».</p>
	<textarea id="type2_worry" name="type2_worry">{data.f.type2_worry ?? ''}</textarea>

	<label>4. Что вы делаете, чтобы справиться?</label>
	{#each COPING as c}
		<label class="inline" style="display: flex">
			<input type="checkbox" name="coping" value={c.id} checked={data.coping.checked?.includes(c.id)} />
			{c.label}
		</label>
	{/each}
	<label for="coping_other">Другое</label>
	<textarea id="coping_other" name="coping_other" style="min-height: 60px">{data.coping.other ?? ''}</textarea>

	<p><button type="submit" class="big">Сохранить</button></p>
	{#if form?.saved}<p class="done">Сохранено.</p>{/if}
	{#if data.f.updated_at}<p class="small muted">Обновлено: {fmtDate(data.f.updated_at)}</p>{/if}
</form>

<p>Дальше — выпишите <a href="/beliefs">убеждения о беспокойстве</a>, которые видны в пункте 3 и 4.</p>
