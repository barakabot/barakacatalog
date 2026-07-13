#!/bin/bash
cd /home/z/my-project
while true; do
  echo "$(date): Starting dev server..."
  bun run dev >> dev.log 2>&1
  echo "$(date): Server exited, restarting in 3s..."
  sleep 3
done
