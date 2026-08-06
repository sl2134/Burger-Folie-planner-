#!/bin/sh
PID_FILE="/tmp/burger-folie-timeplanning.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
  kill "$(cat "$PID_FILE")"
  rm -f "$PID_FILE" /tmp/burger-folie-timeplanning.port
  printf '%s\n' "Burger Folie Timeplanning stopped."
else
  printf '%s\n' "Burger Folie Timeplanning is not running."
fi
