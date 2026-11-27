#!/bin/bash
# Деплой на main-сервер (SPEC 12.1). Запуск в Ubuntu (WSL) из папки проекта:
#   ./deploy.sh --dry-run   — показать, что изменится, ничего не меняя
#   ./deploy.sh             — собрать, выложить, перезапустить
# База (/opt/mct/data) и .env (/opt/mct/.env) лежат вне папки выкладки и не затрагиваются.
set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"

HOST="${DEPLOY_HOST:-main}"
DEST=/opt/mct/app
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

cd "$(dirname "$0")"

echo "== Сборка"
npm run build

echo "== Подготовка файлов для выкладки"
rm -rf .deploy
mkdir -p .deploy/src/lib/server
cp -r build content migrations scripts tts stt package.json package-lock.json .deploy/
cp src/lib/server/password.js src/lib/server/telegram.js .deploy/src/lib/server/

echo "== Выкладка на $HOST:$DEST ${DRY:+(пробный прогон)}"
rsync -avz --delete --chown=root:root $DRY \
	--exclude node_modules/ --exclude .installed-lock \
	.deploy/ "$HOST:$DEST/"

if [ -n "$DRY" ]; then
	echo "Пробный прогон: на сервере ничего не изменено."
	exit 0
fi

echo "== Зависимости и перезапуск"
ssh "$HOST" "set -e; cd $DEST
	if ! cmp -s package-lock.json .installed-lock; then
		npm ci --omit=dev --no-audit --no-fund && cp package-lock.json .installed-lock
	fi
	systemctl restart mct
	systemctl is-enabled --quiet mct-tts && systemctl restart mct-tts || true
	systemctl is-enabled --quiet mct-stt && systemctl restart mct-stt || true
	for i in \$(seq 1 20); do
		code=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/login || true)
		[ \"\$code\" = 200 ] && { echo 'Приложение работает (страница входа отвечает 200).'; exit 0; }
		sleep 1
	done
	echo 'Приложение не ответило. Последние строки журнала:'; journalctl -u mct -n 30 --no-pager; exit 1"
