// Тексты этапов из папки content/ (SPEC 4.8). Читаются при каждом запросе,
// поэтому правка .md или stages.json видна сразу, без перезапуска.
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const DIR = path.resolve('content');

export function getStages() {
	return JSON.parse(fs.readFileSync(path.join(DIR, 'stages.json'), 'utf8')).stages;
}

export function getStage(number) {
	return getStages().find((s) => s.number === number) ?? null;
}

/** HTML описания этапа или null, если текст ещё не написан. */
export function getStageHtml(number) {
	const file = path.join(DIR, 'stages', `${String(number).padStart(2, '0')}.md`);
	if (!fs.existsSync(file)) return null;
	return marked.parse(fs.readFileSync(file, 'utf8'));
}
