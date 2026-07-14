const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

const NEXT_PORT = 3001;
const PROXY_PORT = 3000;
let nextProc = null;
let isStarting = false;

const logFile = fs.openSync('/tmp/wrapper.log', 'a');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.writeSync(logFile, line);
  process.stderr.write(line);
}

function startNext() {
  if (isStarting) return;
  isStarting = true;

  if (nextProc) {
    try { nextProc.kill('SIGTERM'); } catch(e) {}
    nextProc = null;
  }

  log(`Starting Next.js dev on port ${NEXT_PORT}`);
  nextProc = spawn('node_modules/.bin/next', ['dev', '-p', String(NEXT_PORT)], {
    cwd: '/home/z/my-project',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: String(NEXT_PORT),
      NODE_OPTIONS: '--max-old-space-size=512',
    }
  });

  nextProc.stdout.on('data', d => log(`[next:out] ${d.toString().trim()}`));
  nextProc.stderr.on('data', d => log(`[next:err] ${d.toString().trim()}`));
  nextProc.on('error', (err) => {
    log(`Next.js spawn error: ${err.message}`);
    isStarting = false;
    setTimeout(startNext, 3000);
  });
  nextProc.on('exit', (code) => {
    log(`Next.js exited with code ${code}`);
    isStarting = false;
    setTimeout(startNext, 2000);
  });

  // After a delay, check if it's running
  setTimeout(() => {
    if (nextProc && nextProc.exitCode === null) {
      log('Next.js appears to be running');
    }
    isStarting = false;
  }, 5000);
}

// Simple HTTP proxy that buffers the request body
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: NEXT_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${NEXT_PORT}`,
      },
    }, (proxyRes) => {
      // Filter out hop-by-hop headers
      const headers = { ...proxyRes.headers };
      delete headers['transfer-encoding'];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      log(`Proxy error for ${req.method} ${req.url}: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'سرور در حال راه‌اندازی مجدد است...' }));
      }
    });

    if (body.length > 0) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
});

// Handle WebSocket upgrades for HMR
server.on('upgrade', (req, socket, head) => {
  log(`WebSocket upgrade: ${req.url}`);
  const proxy = net.connect(NEXT_PORT, '127.0.0.1', () => {
    proxy.write(head);
    socket.write('HTTP/1.1 101 Switching Protocols\r\n\r\n');
    proxy.pipe(socket);
    socket.pipe(proxy);
  });
  proxy.on('error', () => {
    log('WebSocket proxy error');
    socket.destroy();
  });
  socket.on('error', () => proxy.destroy());
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  log(`Wrapper proxy listening on port ${PROXY_PORT}`);
  startNext();
});

// Health check keep-alive
setInterval(() => {
  if (nextProc && nextProc.exitCode === null) {
    const req = http.get(`http://127.0.0.1:${NEXT_PORT}/api/auth/session`, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => log(`Health check OK: ${data.substring(0, 50)}`));
    });
    req.on('error', (err) => log(`Health check failed: ${err.message}`));
    req.setTimeout(5000, () => { req.destroy(); log('Health check timeout'); });
  } else {
    log('Health check: Next.js not running');
  }
}, 45000);

log('Wrapper process started');