import { JSDOM } from 'jsdom';
import fs from 'fs';

async function testTrace() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="games"></div></body></html>', {
    runScripts: 'dangerously',
    url: 'https://instructure-ramen.hpsschools.org/'
  });
  const win = dom.window;
  
  // Trace all fetch calls
  win.fetch = async (url, opts) => {
    console.log('[TRACE FETCH]', url, opts);
    try {
      const res = await globalThis.fetch(url, opts);
      console.log('[TRACE FETCH RESULT]', url, res.status);
      return res;
    } catch (e) {
      console.error('[TRACE FETCH ERROR]', url, e.message);
      throw e;
    }
  };

  win.Worker = class MockWorker {
    constructor(url) {
      console.log('[TRACE WORKER CREATED]', url);
      this.url = url;
    }
    postMessage(msg) {
      console.log('[TRACE WORKER MSG]', msg);
    }
    addEventListener(evt, fn) {
      console.log('[TRACE WORKER ADD EVT]', evt);
    }
  };

  const script = await fetch('https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js').then(r => r.text());
  win.eval(script);

  console.log('Script evaluated. Lumin is:', typeof win.Lumin);
  if (win.Lumin) {
    try {
      await win.Lumin.init({ headless: true });
      console.log('Init finished! Lumin keys:', Object.keys(win.Lumin));
    } catch (e) {
      console.error('Init failed:', e);
    }
  }
}

testTrace().catch(console.error);
