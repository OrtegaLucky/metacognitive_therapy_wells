<script>
	import { fmtDate } from '$lib/labels.js';

	let { data, form } = $props();
</script>

<h1>Настройки</h1>

<form method="POST" class="card">
	<label for="w">Вечернее окно для беспокойства</label>
	<input id="w" name="reminder_worry_window" type="time" value={data.profile.reminder_worry_window ?? ''} />

	<label for="a">Тренировка внимания (ATT), необязательно</label>
	<input id="a" name="reminder_att" type="time" value={data.profile.reminder_att ?? ''} />

	<label for="r">Еженедельный обзор</label>
	<input id="r" name="reminder_weekly_review" type="text" placeholder="Например: вс 19:00" value={data.profile.reminder_weekly_review ?? ''} />

	<label for="c">Telegram chat id</label>
	<input id="c" name="telegram_chat_id" type="text" inputmode="numeric" value={data.profile.telegram_chat_id ?? ''} />
	<p class="small muted">Напоминания в Telegram заработают в Фазе 3.</p>

	{#if form?.error}<p class="error">{form.error}</p>{/if}
	<p><button type="submit">Сохранить</button></p>
	{#if form?.saved}<p class="done">Сохранено.</p>{/if}
</form>

<p class="small muted">Начало программы: {fmtDate(data.profile.started_at)}</p>
