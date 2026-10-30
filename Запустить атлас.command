#!/bin/bash
# Запускает атлас на этом компьютере и показывает QR-код для iPhone (тот же Wi-Fi).
cd "$(dirname "$0")" || exit 1
if [ ! -d dist ]; then echo "Папка dist не найдена. Сначала выполните: npm run build"; read -r -p "Нажмите Enter…"; exit 1; fi
if command -v node >/dev/null 2>&1 && [ -f scripts/serve.mjs ]; then
  exec node scripts/serve.mjs
fi
# Запасной вариант без Node.js: обычный сервер Python (QR-кода не будет).
PORT=8765
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo "Атлас тела человека: http://127.0.0.1:$PORT/"
[ -n "$IP" ] && echo "На iPhone (тот же Wi-Fi): http://$IP:$PORT/"
echo "Чтобы остановить, закройте это окно или нажмите Ctrl+C."
( sleep 1; open "http://127.0.0.1:$PORT/" ) &
cd dist && exec python3 -m http.server "$PORT"
