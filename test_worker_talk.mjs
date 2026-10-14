import fs from 'fs';

let text = fs.readFileSync('./worker.tmp.js', 'utf8');

let capturedOnConnect = null;

text = text.replace(
  'll(d)',
  'll(d); globalThis.capturedOnConnect = t.onconnect;'
);

eval(text);

console.log('Worker loaded. Setting up client connection...');

// Create a simulated client port
let clientOnMessage = null;
let workerOnMessage = null;

const clientPort = {
  postMessage(data) {
    console.log('[WORKER SENT TO CLIENT]:', typeof data, JSON.stringify(data).slice(0, 300));
    if (clientOnMessage) clientOnMessage({ data });
  },
  set onmessage(fn) {
    clientOnMessage = fn;
    console.log('[CLIENT set onmessage handler]');
  },
  get onmessage() {
    return clientOnMessage;
  },
  start() {}
};

// Connect event
globalThis.capturedOnConnect({
  ports: [{
    postMessage(data) {
      console.log('[CLIENT SENT TO WORKER]:', typeof data, JSON.stringify(data).slice(0, 300));
      if (workerOnMessage) workerOnMessage({ data });
    },
    set onmessage(fn) {
      workerOnMessage = fn;
      console.log('[WORKER set onmessage handler]');
    },
    get onmessage() {
      return workerOnMessage;
    },
    start() {}
  }]
});

// Let's see what happens if client sends __INIT__ or SEARCH_GAMES or FETCH_CATEGORIES!
setTimeout(() => {
  console.log('Sending __INIT__ to worker...');
  if (workerOnMessage) {
    workerOnMessage({
      data: { type: '__INIT__' }
    });
  }
}, 500);

setTimeout(() => {
  console.log('Sending FETCH_CATEGORIES or SEARCH_GAMES...');
  if (workerOnMessage) {
    workerOnMessage({
      data: { type: 'SEARCH_GAMES', query: '', page: 1, limit: 10 }
    });
  }
}, 1000);
