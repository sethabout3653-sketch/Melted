import fs from 'fs';

let text = fs.readFileSync('./worker.tmp.js', 'utf8');
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

// Step 1: Send __INIT__
workerHandler({ data: { type: '__INIT__' } });

// Step 2: Send FETCH_CATEGORIES
setTimeout(() => {
  console.log('Sending FETCH_CATEGORIES...');
  workerHandler({ data: { type: 'FETCH_CATEGORIES', id: 1 } });
}, 200);

// Step 3: Send SEARCH_GAMES
setTimeout(() => {
  console.log('Sending SEARCH_GAMES...');
  workerHandler({
    data: {
      type: 'SEARCH_GAMES',
      id: 2,
      query: '',
      category: '',
      page: 1,
      limit: 20
    }
  });
}, 500);

setTimeout(() => {
  process.exit(0);
}, 2000);
