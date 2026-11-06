const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const candidates = JSON.parse(fs.readFileSync('raw_candidates.json', 'utf8'));
console.log(`Starting fast verification of ${candidates.length} candidates...`);

const verified = [];
const BATCH_SIZE = 300;

function checkUrl(candidate) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(candidate.url);
      const mod = parsed.protocol === 'https:' ? https : http;
      
      const req = mod.get(candidate.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 1800
      }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 350) {
          let body = '';
          res.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 500) {
              res.destroy(); // Got enough data to verify
            }
          });
          res.on('close', () => {
            if (body.includes('#EXTM3U') || body.includes('#EXTINF') || res.statusCode === 200 || res.statusCode === 302) {
              let name = candidate.name.replace(/\([^\)]*\)/g, '').replace(/ group-title=.*$/, '').trim();
              if (name.length > 35) name = name.substring(0, 35);
              resolve({
                name: name || 'TV Channel',
                category: candidate.category || 'General',
                logo: candidate.logo || '',
                url: candidate.url
              });
            } else {
              resolve(null);
            }
          });
          res.on('error', () => resolve(null));
        } else {
          res.resume();
          resolve(null);
        }
      });
      
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

async function run() {
  const seenUrls = new Set();
  const seenNames = new Set();
  
  for (let i = 0; i < candidates.length && verified.length < 550; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(checkUrl));
    
    for (const r of results) {
      if (r && !seenUrls.has(r.url) && !seenNames.has(r.name.toLowerCase())) {
        seenUrls.add(r.url);
        seenNames.add(r.name.toLowerCase());
        verified.push(r);
      }
    }
    console.log(`Checked ${Math.min(i + BATCH_SIZE, candidates.length)} / ${candidates.length} -> Verified: ${verified.length}`);
  }
  
  console.log(`TOTAL VERIFIED STREAMS: ${verified.length}`);
  fs.writeFileSync('verified_500.json', JSON.stringify(verified, null, 2));
}

run();
