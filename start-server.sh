#!/bin/bash
cd /home/z/my-project
export PATH="/usr/local/bin:$PATH"
echo $$ > /tmp/server-wrapper.pid
while true; do
  echo "$(date '+%H:%M:%S') Starting Next.js dev server..." >> /tmp/server-monitor.log
  /home/z/my-project/node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "$(date '+%H:%M:%S') Server exited with code $EXIT_CODE, restarting in 2s..." >> /tmp/server-monitor.log
  sleep 2
done
