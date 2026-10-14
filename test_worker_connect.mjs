import fs from 'fs';

const text = fs.readFileSync('./worker.tmp.js', 'utf8');

const mockSelf = {
  onconnect: null,
  addEventListener: () => {},
  postMessage: () => {},
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

console.log('Worker loaded. Setting up port channel...');

// Create a simulated port
let clientPortOnMessage = null;
const clientPort = {
  postMessage(msg) {
    console.log('[CLIENT RECEIVED MSG]', JSON.stringify(msg).slice(0, 300));
    if (clientPortOnMessage) clientPortOnMessage({ data: msg });
  },
  set onmessage(fn) {
    clientPortOnMessage = fn;
  },
  get onmessage() {
    return clientPortOnMessage;
  },
  start() {}
};

// Dispatch connect event
if (typeof mockSelf.onconnect === 'function') {
  mockSelf.onconnect({
    ports: [clientPort]
  });
} else if (typeof mockSelf.onconnect === 'object' && mockSelf.onconnect !== null) {
  // It might be an event handler object or function
  console.log('mockSelf.onconnect type:', typeof mockSelf.onconnect);
}

console.log('Finished setup.');
