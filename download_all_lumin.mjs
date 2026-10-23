import fs from 'fs';

const realFetch = globalThis.fetch;
let text = fs.readFileSync('./worker.tmp.js', 'utf8');
text = text.replace('ll(d)', 'll(d); globalThis.capturedOnConnect = t.onconnect;');
eval(text);

let workerHandler = null;
const messageListeners = new Map();

globalThis.capturedOnConnect({
  ports: [{
    postMessage(data) {
      if (data.id && messageListeners.has(data.id)) {
        messageListeners.get(data.id)(data);
        messageListeners.delete(data.id);
      }
    },
    set onmessage(fn) { workerHandler = fn; },
    start() {}
  }]
});

workerHandler({
  data: {
    type: '__INIT__',
    apiBase: 'https://a.luminsdk.com',
    domains: ['https://a.luminsdk.com'],
    godDomains: ['https://a.luminsdk.com']
  }
});

let msgId = 10;
function sendQuery(type, payload) {
  return new Promise((resolve) => {
    const id = ++msgId;
    messageListeners.set(id, resolve);
    workerHandler({
      data: {
        type,
        id,
        ...payload
      }
    });
  });
}

async function fetchAll() {
  // First page with limit 100
  const first = await sendQuery('SEARCH_GAMES', { query: '', category: '', page: 1, limit: 100 });
  console.log('Total games reported:', first.result.total, 'Pages:', first.result.pages);
  
  const allGames = [...first.result.games];
  const totalPages = first.result.pages;
  
  for (let p = 2; p <= totalPages; p++) {
    const res = await sendQuery('SEARCH_GAMES', { query: '', category: '', page: p, limit: 100 });
    if (res.result?.games) {
      allGames.push(...res.result.games);
      console.log(`Page ${p}/${totalPages}: fetched ${res.result.games.length} games (total so far: ${allGames.length})`);
    }
  }

  console.log('FINISHED! Total collected:', allGames.length);
  fs.writeFileSync('./src/data/luminSdkGames.json', JSON.stringify(allGames, null, 2));
}

setTimeout(fetchAll, 300);
