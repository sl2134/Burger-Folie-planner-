#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="/tmp/burger-folie-iphone.pid"
PORT_FILE="/tmp/burger-folie-iphone.port"
LOG_FILE="/tmp/burger-folie-iphone.log"
PORT=57420

get_ip() {
  ipconfig getifaddr en0 2>/dev/null ||
  ipconfig getifaddr en1 2>/dev/null ||
  ifconfig | awk '/inet / && $2 !~ /^127\\./ { print $2; exit }'
}

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
  PORT="$(cat "$PORT_FILE" 2>/dev/null)"
else
  cd "$DIR" || exit 1
  python3 -m http.server "$PORT" --bind 0.0.0.0 >"$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  sleep 1
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    osascript -e 'display dialog "Kon de iPhone server niet starten. Controleer of Python 3 geinstalleerd is." buttons {"OK"} default button "OK"' 2>/dev/null
    exit 1
  fi
  printf '%s\n' "$SERVER_PID" >"$PID_FILE"
  printf '%s\n' "$PORT" >"$PORT_FILE"
fi

IP="$(get_ip)"
URL="http://$IP:$PORT/index.html"
open "$URL" 2>/dev/null
osascript -e "display dialog \"Open deze link op je iPhone in Safari:\\n\\n$URL\\n\\nDaarna: Deel-knop > Zet op beginscherm.\" buttons {\"OK\"} default button \"OK\"" 2>/dev/null
