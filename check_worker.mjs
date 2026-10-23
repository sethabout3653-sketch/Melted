import fs from 'fs';

async function check() {
  const res = await fetch('https://a.luminsdk.com/v1/lumin.worker.js');
  const text = await res.text();
  console.log('Worker size:', text.length);
  fs.writeFileSync('./worker.tmp.js', text);
  
  // Search for endpoints or paths
  const paths = text.match(/\/api\/[a-zA-Z0-9_\-\/]+/g) || [];
  console.log('Unique API paths:', [...new Set(paths)]);

  const urls = text.match(/https?:\/\/[a-zA-Z0-9_\-\.\:]+/g) || [];
  console.log('Unique URLs:', [...new Set(urls)]);
}

check().catch(console.error);
