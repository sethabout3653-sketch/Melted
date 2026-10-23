import { JSDOM } from 'jsdom';

async function testTrace() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="games"></div></body></html>', {
    runScripts: 'dangerously',
    url: 'https://instructure-ramen.hpsschools.org/'
  });
  const win = dom.window;
  
  win.fetch = async (url, opts) => {
    console.log('[FETCH]', url);
    return globalThis.fetch(url, opts);
  };

  // Inspect createObjectURL
  const origCreateObjectURL = win.URL.createObjectURL;
  win.URL.createObjectURL = (blob) => {
    console.log('[createObjectURL]', blob.type, blob.size);
    if (origCreateObjectURL) return origCreateObjectURL(blob);
    return 'blob:mock-url';
  };

  win.MessageChannel = class MockMessageChannel {
    constructor() {
      this.port1 = { onmessage: null, postMessage: (msg) => console.log('[PORT1 postMessage]', msg) };
      this.port2 = { onmessage: null, postMessage: (msg) => console.log('[PORT2 postMessage]', msg) };
    }
  };

  win.Worker = class MockWorker {
    constructor(url) {
      console.log('[WORKER constructor]', url);
      this.onmessage = null;
    }
    postMessage(msg) {
      console.log('[WORKER postMessage]', msg);
    }
    addEventListener(type, listener) {
      console.log('[WORKER addEventListener]', type);
    }
  };

  const script = await fetch('https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js').then(r => r.text());
  win.eval(script);

  console.log('Script evaluated.');
  if (win.Lumin) {
    try {
      const p = win.Lumin.init({ headless: true });
      setTimeout(() => {
        console.log('5s timeout check. Lumin keys:', Object.keys(win.Lumin));
      }, 5000);
      await p;
    } catch (e) {
      console.error('Init failed:', e.message);
    }
  }
}

testTrace().catch(console.error);
