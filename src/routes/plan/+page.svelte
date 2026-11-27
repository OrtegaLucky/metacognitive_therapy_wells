<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const p = $derived(data.plan ?? {});
	const STEPS_HINT =
		'1. Замечаю: это мысль-триггер, а не задача.\n2. Не спорю с ней и не прокручиваю: «подумаю об этом вечером».\n3. Если есть конкретный шаг — делаю его, если нет — откладываю до окна.\n4. Возвращаюсь к тому, чем был занят.';
</script>

<h1>Мой план</h1>
<p class="muted small">
	Ваш собственный способ обходиться с беспокойством — то, что вы проверили на этапах 2–8. Держите его коротким: чтобы можно
	было прочитать за минуту, когда трудно.
</p>

<form method="POST" class="card" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<h2 style="margin-top: 0">На случай триггера</h2>
	<label for="triggers">Мои типичные триггеры</label>
	<textarea id="triggers" name="triggers">{p.triggers ?? data.hints.triggers}</textarea>

	<label for="steps">Что я делаю, когда замечаю триггер</label>
	<textarea id="steps" name="steps" style="min-height: 140px" placeholder={STEPS_HINT}>{p.steps ?? ''}</textarea>

	<label for="warning_signs">Признаки, что я снова вовлекаюсь в беспокойство</label>
	<textarea id="warning_signs" name="warning_signs" placeholder="Например: долго не могу уснуть, ищу в интернете, звоню проверить">{p.warning_signs ?? ''}</textarea>

	<h2>Старый способ → новый способ</h2>
	<p class="small muted">Этап 10. Что вы делали раньше и что делаете теперь — по пунктам.</p>
	<label for="old_way">Старый способ</label>
	<textarea id="old_way" name="old_way">{p.old_way ?? data.hints.old_way}</textarea>
	<label for="new_way">Новый способ</label>
	<textarea id="new_way" name="new_way" placeholder="Например: откладываю до окна; не ищу успокоения; делаю шаг, если он есть">{p.new_way ?? ''}</textarea>

	<p><button type="submit" class="big">Сохранить</button></p>
	{#if form?.saved}<p class="done">Сохранено.</p>{/if}
</form>
