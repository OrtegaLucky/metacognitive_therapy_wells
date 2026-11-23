<script>
	let { form } = $props();
</script>

<h1>Вход</h1>
<form method="POST" class="card">
	<label for="password">Пароль</label>
	<!-- svelte-ignore a11y_autofocus -->
	<input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
	{#if form?.error}<p class="error">{form.error}</p>{/if}
	<p><button type="submit" class="big">Войти</button></p>
</form>
