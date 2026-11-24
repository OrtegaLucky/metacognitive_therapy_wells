// Спрашивает пароль (не показывая его на экране) и печатает строку PASSWORD_HASH=... для .env.
// Если передан путь к .env (node scripts/hash-password.js /opt/mct/.env), сразу записывает хеш туда.
import fs from 'node:fs';
import readline from 'node:readline';
import { hashPassword } from '../src/lib/server/password.js';

function ask(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		rl._writeToOutput = (s) => {
			if (s.startsWith(question)) rl.output.write(s);
		};
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		});
	});
}

const first = await ask('Пароль: ');
if (first.length < 12) {
	console.error('Слишком короткий пароль: нужно не меньше 12 символов.');
	process.exit(1);
}
const second = await ask('Ещё раз: ');
if (first !== second) {
	console.error('Пароли не совпали.');
	process.exit(1);
}
const line = `PASSWORD_HASH=${hashPassword(first)}`;
const envFile = process.argv[2];

if (envFile) {
	const text = fs.readFileSync(envFile, 'utf8');
	const next = /^PASSWORD_HASH=.*$/m.test(text) ? text.replace(/^PASSWORD_HASH=.*$/m, line) : text.trimEnd() + '\n' + line + '\n';
	fs.writeFileSync(envFile, next);
	console.error(`Хеш записан в ${envFile}. Перезапустите приложение, чтобы новый пароль заработал.`);
} else {
	console.log(line);
	console.error('Вставьте эту строку в .env. Сам пароль нигде не хранится.');
}
