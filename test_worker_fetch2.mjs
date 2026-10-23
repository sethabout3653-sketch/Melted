import fs from 'fs';

const realFetch = globalThis.fetch;

let text = fs.readFileSync('./worker.tmp.js', 'utf8');

globalThis.fetch = async (...args) => {
  console.log('[GLOBAL FETCH]', args[0], args[1]?.method || 'GET');
  try {
    const res = await realFetch(...args);
    console.log('[GLOBAL FETCH SUCCESS]', args[0], res.status);
    return res;
  } catch (e) {
    console.error('[GLOBAL FETCH FAILED]', args[0], e.message);
    throw e;
  }
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

setTimeout(() => {
  console.log('Sending FETCH_CATEGORIES...');
  workerHandler({ data: { type: 'FETCH_CATEGORIES', id: 1 } });
}, 500);

setTimeout(() => {
  console.log('Sending SEARCH_GAMES...');
  workerHandler({
    data: {
      type: 'SEARCH_GAMES',
      id: 2,
      query: '',
      category: '',
      page: 1,
      limit: 10
    }
  });
}, 1200);

setTimeout(() => {
  process.exit(0);
}, 5000);
