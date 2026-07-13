const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

const NEXT_PORT = 3001;
const PROXY_PORT = 3000;
let nextProc = null;

function startNext() {
  if (nextProc) {
    nextProc.kill('SIGTERM');
    nextProc = null;
  }
  console.log('[wrapper] Starting Next.js on port ' + NEXT_PORT);
  nextProc = spawn('node_modules/.bin/next', ['start', '-p', String(NEXT_PORT)], {
    cwd: '/home/z/my-project',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', PORT: String(NEXT_PORT) }
  });
  nextProc.stdout.on('data', d => console.log('[next]', d.toString().trim()));
  nextProc.stderr.on('data', d => console.error('[next]', d.toString().trim()));
  nextProc.on('exit', (code) => {
    console.log('[wrapper] Next.js exited with code', code, '- restarting in 2s...');
    setTimeout(startNext, 2000);
  });
}

// Simple HTTP proxy
const server = http.createServer((req, res) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end('Next.js starting... please retry');
  });
  req.pipe(proxyReq);
});

// Handle upgrades for HMR in dev mode
server.on('upgrade', (req, socket, head) => {
  const proxy = net.connect(NEXT_PORT, '127.0.0.1', () => {
    proxy.write(head);
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    proxy.pipe(socket);
    socket.pipe(proxy);
  });
  proxy.on('error', () => socket.destroy());
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log('[wrapper] Proxy listening on port ' + PROXY_PORT);
  startNext();
});

// Keep alive
setInterval(() => {
  if (nextProc && nextProc.exitCode === null) {
    http.get('http://127.0.0.1:' + NEXT_PORT + '/api/auth/session', (res) => {
      res.resume();
    }).on('error', () => {});
  }
}, 30000);
