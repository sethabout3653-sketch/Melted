import fs from 'fs';

async function inspect() {
  const bootRes = await fetch('https://a.luminsdk.com/api/v1/boot?t=e5ca67ce8de99fd9e31313159a65bbe8');
  const bootData = await bootRes.json();
  const full = bootData.join('\n');
  fs.writeFileSync('./boot_full.js', full);
  
  const idx = full.indexOf('domain fetch failed');
  console.log('Index:', idx);
  console.log(full.substring(Math.max(0, idx - 500), idx + 200));
}

inspect().catch(console.error);
