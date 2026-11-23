// Печатает случайный ключ шифрования базы (64 символа 0-9a-f) для DB_KEY в .env
import crypto from 'node:crypto';

console.log(crypto.randomBytes(32).toString('hex'));
console.error('Вставьте эту строку в .env как DB_KEY=... и сохраните копию отдельно (менеджер паролей).');
