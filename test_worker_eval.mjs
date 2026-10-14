import fs from 'fs';

const text = fs.readFileSync('./worker.tmp.js', 'utf8');

const mockSelf = {
  onconnect: null,
  onmessage: null,
  addEventListener(evt, fn) {
    console.log('[MOCK_SELF addEventListener]', evt);
  },
  postMessage(msg) {
    console.log('[MOCK_SELF postMessage]', msg);
  },
  importScripts: () => {},
  fetch: globalThis.fetch,
  crypto: globalThis.crypto,
  atob: globalThis.atob,
  btoa: globalThis.btoa,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};

globalThis.self = mockSelf;
global.self = mockSelf;

eval(text);

console.log('SUCCESS! Worker evaluated!');
console.log('mockSelf.onconnect is:', typeof mockSelf.onconnect);
