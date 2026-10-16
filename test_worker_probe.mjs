import fs from 'fs';

const realFetch = globalThis.fetch;
let text = fs.readFileSync('./worker.tmp.js', 'utf8');

globalThis.fetch = async (...args) => {
  console.log('[WORKER FETCH]', args[0], args[1]?.method || 'GET', args[1]?.body ? JSON.stringify(args[1].body) : '');
  return realFetch(...args);
};

text = text.replace('ll(d)', 'll(d); globalThis.capturedOnConnect = t.onconnect;');
eval(text);

let workerHandler = null;
const clientPort = {
  postMessage(data) {
    console.log('[WORKER -> CLIENT]:', JSON.stringify(data));
  },
  set onmessage(fn) {
    workerHandler = fn;
  },
  start() {}
};

globalThis.capturedOnConnect({
  ports: [clientPort]
});

workerHandler({
  data: {
    type: '__INIT__',
    apiBase: 'https://a.luminsdk.com',
    domains: ['https://a.luminsdk.com'],
    godDomains: ['https://a.luminsdk.com']
  }
});

// Test PROBE_GAME_URL
setTimeout(() => {
  console.log('Sending PROBE_GAME_URL for selenite/slope2...');
  workerHandler({
    data: {
      type: 'PROBE_GAME_URL',
      id: 3,
      gameId: 'selenite/slope2'
    }
  });
}, 800);

setTimeout(() => {
  process.exit(0);
}, 3500);
