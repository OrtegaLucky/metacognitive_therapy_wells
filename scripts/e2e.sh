#!/bin/bash
# Прогон приложения на временной базе с тестовым паролем. Реальный .env не используется.
export PATH=/home/ortega/.local/node/bin:$PATH
cd /home/ortega/projects_claude/metacognitive_therapy_wells
T=/tmp/mct-test; rm -rf $T; mkdir -p $T
PW=$(node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))")
export DB_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export PASSWORD_HASH=$(node --input-type=module -e "import {hashPassword} from './src/lib/server/password.js'; console.log(hashPassword(process.argv[1]))" "$PW")
export DB_PATH=$T/app.db
export PORT=3999 HOST=127.0.0.1 ORIGIN=http://127.0.0.1:3999
B=$ORIGIN
J=$T/jar
# Рабочая сборка (как на сервере). Cookie с флагом Secure curl по http не шлёт,
# поэтому храним её сами и передаём заголовком.
start() { (node build > $T/server.log 2>&1 &) ; for i in $(seq 1 40); do curl -s -o /dev/null $B/login && return; sleep 0.5; done; echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; cat $T/server.log; exit 1; }
stop() { pkill -f 'node build' ; sleep 1; }
c() {
	local sid=$(cat $J 2>/dev/null)
	curl -s -o $T/out.html -D $T/hdr -w '%{http_code} %{redirect_url}\n' ${sid:+-H "Cookie: sid=$sid"} -H "Origin: $B" -H 'Accept: text/html' "$@"
	local n=$(grep -i '^set-cookie: sid=' $T/hdr | sed -E 's/^[^=]*=([^;]*).*/\1/' | tr -d '\r')
	if grep -qi '^set-cookie: sid=;' $T/hdr || grep -qi '^set-cookie: sid=.*Max-Age=0' $T/hdr; then rm -f $J; elif [ -n "$n" ]; then echo "$n" > $J; fi
}
ok() { if [ "$1" = "$2" ]; then echo "  ✓ $3"; else echo "  ✗ $3 (ожидали $2, получили $1)"; FAIL=1; fi; }
has() { if grep -q "$1" $T/out.html; then echo "  ✓ на странице: $1"; else echo "  ✗ нет на странице: $1"; FAIL=1; fi; }
FAIL=0
start
echo "1. Без входа"
ok "$(c $B/ | cut -d' ' -f1)" 303 "главная перенаправляет на вход"
echo "2. Вход"
ok "$(c -d password=wrong $B/login | cut -d' ' -f1)" 400 "неверный пароль отклонён"
ok "$(c --data-urlencode password=$PW $B/login | cut -d' ' -f1)" 303 "верный пароль принят"
test -s $J && echo "  ✓ cookie сессии выдана" || { echo "  ✗ нет cookie"; FAIL=1; }
echo "3. Этап 1"
ok "$(c $B/ | cut -d' ' -f1)" 200 "главная открывается"; has "Модель и концептуализация"
ok "$(c -d "trigger_examples=Новости&worry_chain=Прокручиваю&type2_worry=Не смогу остановиться&coping=suppress&coping=reassurance&coping_other=" $B/formulation | cut -d' ' -f1)" 200 "концептуализация сохранена"
for t in uncontrollability danger usefulness; do ok "$(c -d "type=$t&text=Тест $t&percent=80" "$B/beliefs?/add" | cut -d' ' -f1)" 200 "убеждение $t"; done
ok "$(c -d "id=1&percent=70" "$B/beliefs?/rate" | cut -d' ' -f1)" 200 "переоценка убеждения"
ok "$(c -d "percent=80&type=danger&text=" "$B/beliefs?/add" | cut -d' ' -f1)" 400 "пустое убеждение отклонено"
ok "$(c -d "q0=1&q1=2&q2=1&q3=0&q4=3&q5=1&q6=2" $B/scales | cut -d' ' -f1)" 303 "GAD-7 сохранена"
c $B/scales >/dev/null; has "10 из 21"
c $B/stage >/dev/null; has "Перейти на этап 2"
ok "$(c -d "" "$B/stage?/advance" | cut -d' ' -f1)" 303 "переход 1 → 2"
echo "4. Этап 2"
c $B/ >/dev/null; has "Отстранённая осознанность"; has "Заметил триггер"
for i in $(seq 1 10); do c -d "kind=trigger&postponed=yes&note=мысль $i&back=/" "$B/diary?/add" >/dev/null; done
c -d "kind=worry_window&wanted_to_worry=no&minutes_used=5&note=" "$B/diary?/add" >/dev/null
c "$B/diary?kind=trigger" >/dev/null; has "мысль 10"
c $B/stage >/dev/null; has "10 из 10"; has "Дней на этапе: 0 из 7 (осталось 7)"; has "Пока нет"
ok "$(c -d "" "$B/stage?/advance" | cut -d' ' -f1)" 400 "переход 2 → 3 без 7 дней запрещён"
c $B/window >/dev/null; has "Хочется ли сейчас беспокоиться"
ok "$(c -d "wanted=yes&minutes=7&note=окно тест" $B/window | cut -d' ' -f1)" 200 "вечернее окно сохранено"
c "$B/diary?kind=worry_window" >/dev/null; has "окно тест"; has "7 мин"
ok "$(c -d "exercise=assoc&minutes=2&note=" $B/exercises | cut -d' ' -f1)" 200 "упражнение сохранено"
ok "$(c -d "exercise=bad&minutes=2" $B/exercises | cut -d' ' -f1)" 400 "неизвестное упражнение отклонено"
c "$B/diary?kind=att" >/dev/null; has "Свободная ассоциация"
c $B/reminder.ics >/dev/null; has "RRULE:FREQ=DAILY"; has "TZID=Europe/Moscow:"
ok "$(c -d "kind=trigger&postponed=no&note=&back=/?logged=1" "$B/diary?/add" | cut -d' ' -f2)" "$B/?logged=1" "быстрая кнопка триггера возвращает на главную"
c "$B/?logged=1" >/dev/null; has "Возвращайтесь к своим делам"
ok "$(c -d "back=//evil.example&kind=free&note=x" "$B/diary?/add" | cut -d' ' -f2)" "$B/diary?added=1" "внешний адрес возврата не принимается"
echo "5. Подделка формы с чужого сайта"
ok "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: sid=$(cat $J)" -H 'Accept: text/html' -H 'Origin: https://evil.example' -d 'kind=free&note=x' "$B/diary?/add")" 403 "чужой Origin отклонён"
echo "6. Перезапуск: данные сохраняются"
stop; start
c $B/ >/dev/null; has "Отстранённая осознанность"
ok "$(c -d "confirm=yes" "$B/stage?/force" | cut -d' ' -f1)" 303 "ручной переход 2 → 3"
c $B/stage >/dev/null; has "(вручную)"
echo "6а. Этап 3, настройки, напоминания"
c $B/stage >/dev/null; has "Завершённых экспериментов: 0 из 2"
c $B/ >/dev/null; has "Усилить и отпустить"
ok "$(c -d "kind=amplify_release&belief_id=&prediction=не смогу остановиться&prediction_percent=70&belief_before_percent=" "$B/experiments?/create" | cut -d' ' -f1)" 200 "эксперимент этапа 3 создан"
c $B/experiments >/dev/null; has "Пройти с таймером"
ok "$(c -d "kind=stop_reassurance&belief_id=&prediction=тревога будет расти&prediction_percent=60&belief_before_percent=" "$B/experiments?/create" | cut -d' ' -f1)" 400 "эксперимент этапа 6 на этапе 3 ещё закрыт"
ok "$(c -d "reminder_worry_window=18:00&reminder_att=12:00&reminder_weekly_review=&telegram_chat_id=123" "$B/settings?/save" | cut -d' ' -f1)" 200 "настройки сохранены"
ok "$(c -d "" "$B/settings?/telegram" | cut -d' ' -f1)" 400 "без токена бота проверка честно отказывает"
echo "7. Заголовки"; curl -s -D - -o /dev/null $B/login | grep -i "access-control" && { echo "  ✗ лишний CORS-заголовок"; FAIL=1; }
curl -s -D - -o /dev/null -H "Cookie: sid=$(cat $J)" $B/ | grep -iE '^(content-security-policy|x-frame-options|referrer-policy|cache-control):' | cut -c1-90
curl -s -D - -o /dev/null $B/login | grep -qi "^referrer-policy: no-referrer" && { echo "  ✗ no-referrer ломает формы в браузере (Origin: null)"; FAIL=1; } || echo "  ✓ Referrer-Policy не ломает формы"
echo "8. Шифрование файла базы"
head -c 16 $DB_PATH | grep -q 'SQLite format' && { echo "  ✗ база НЕ зашифрована"; FAIL=1; } || echo "  ✓ файл базы не читается как обычная SQLite"
ls -l $DB_PATH | cut -d' ' -f1
echo "9. Выход"
ok "$(c -d "" $B/logout | cut -d' ' -f1)" 303 "выход"
ok "$(c $B/ | cut -d' ' -f1)" 303 "после выхода снова нужен вход"
echo "10. Подбор пароля"
for i in $(seq 1 6); do r=$(curl -s -o /dev/null -w '%{http_code}' -H "Origin: $B" -H "Accept: text/html" -d password=x $B/login); done; ok "$r" 429 "6-я попытка за минуту заблокирована"
stop
r=$(TELEGRAM_BOT_TOKEN= node scripts/remind.js --dry-run 2>&1; echo "код $?"); echo "$r" | grep -q "код 0" && echo "  ✓ скрипт напоминаний открывает базу" || { echo "  ✗ скрипт напоминаний: $r"; FAIL=1; }
echo "--- ошибки сервера:"; grep -iE 'error|warn' $T/server.log | head -10
echo "ИТОГ: $([ $FAIL = 0 ] && echo 'всё прошло' || echo 'ЕСТЬ ОШИБКИ')"
rm -rf $T
