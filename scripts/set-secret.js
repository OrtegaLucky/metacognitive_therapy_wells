// Записывает секрет (ключ API) в .env на сервере, не показывая его на экране и нигде не печатая.
// Запуск на сервере: node scripts/set-secret.js OPENAI_API_KEY /opt/mct/.env
import fs from 'node:fs';
import readline from 'node:readline';

const ALLOWED = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_RELAY_URL', 'GEMINI_RELAY_SECRET', 'TELEGRAM_BOT_TOKEN'];
const [name, envFile] = process.argv.slice(2);

if (!ALLOWED.includes(name) || !envFile) {
	console.error(`Использование: node scripts/set-secret.js <${ALLOWED.join('|')}> /opt/mct/.env`);
	process.exit(1);
}

function ask(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		rl._writeToOutput = (s) => {
			if (s.startsWith(question)) rl.output.write(s);
		};
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer.trim());
		});
	});
}

const value = await ask(`${name} (ввод не отображается): `);
if (!value || /\s/.test(value)) {
	console.error('Пусто или есть пробелы — ничего не записано.');
	process.exit(1);
}

const line = `${name}=${value}`;
const re = new RegExp(`^${name}=.*$`, 'm');
const text = fs.readFileSync(envFile, 'utf8');
fs.writeFileSync(envFile, re.test(text) ? text.replace(re, line) : text.trimEnd() + '\n' + line + '\n');
console.error(`${name} записан в ${envFile} (${value.length} символов). Перезапустите приложение: systemctl restart mct`);
