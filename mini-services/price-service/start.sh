#!/bin/bash
cd "$(dirname "$0")"
exec python3 -m uvicorn index:app --host "${PRICE_SERVICE_HOST:-127.0.0.1}" --port "${PORT:-3002}"
