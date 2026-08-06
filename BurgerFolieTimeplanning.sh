#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/index.html"

if command -v python3 >/dev/null 2>&1; then
  cd "$DIR" || exit 1
  PORT=57413
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/burger-folie-timeplanning.log 2>&1 &
  SERVER_PID=$!
  sleep 1
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "http://127.0.0.1:$PORT/index.html"
    elif command -v open >/dev/null 2>&1; then
      open "http://127.0.0.1:$PORT/index.html"
    else
      printf '%s\n' "http://127.0.0.1:$PORT/index.html"
    fi
    wait "$SERVER_PID"
    exit 0
  fi
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP"
elif command -v open >/dev/null 2>&1; then
  open "$APP"
else
  printf '%s\n' "$APP"
fi
