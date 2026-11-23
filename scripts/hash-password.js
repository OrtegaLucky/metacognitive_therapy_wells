// Спрашивает пароль (не показывая его на экране) и печатает строку PASSWORD_HASH=... для .env
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
console.log(`PASSWORD_HASH=${hashPassword(first)}`);
console.error('Вставьте эту строку в .env. Сам пароль нигде не хранится.');
