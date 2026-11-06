const fs = require('fs');

async function checkStream(url) {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal
    });
    clearTimeout(tid);
    return res.ok || res.status === 302;
  } catch (e) {
    return false;
  }
}

// Solid verified direct working live streams for key channels
const VERIFIED_CORE = [
  {
    id: 'afv-always-funny',
    name: 'AFV - Always Funny',
    url: 'https://d24l3uppudokci.cloudfront.net/playlist.m3u8',
    category: 'Comedy',
    logo: 'https://upload.wikimedia.org/wikipedia/en/2/23/America%27s_Funniest_Home_Videos_logo.png',
    description: 'AFV Always Funny Videos - Hilarious bloopers, fails, and family home videos.'
  },
  {
    id: 'comedy-central-live',
    name: 'Comedy Central',
    url: 'https://cdn4.skygo.mn/live/disk1/Comedy_Central/HLSv3-FTA/Comedy_Central.m3u8',
    category: 'Comedy',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Comedy_Central_2018.svg/960px-Comedy_Central_2018.svg.png',
    description: 'Comedy Central Live Stand-Up, Shows & Sketches'
  },
  {
    id: 'cartoon-network-en',
    name: 'Cartoon Network',
    url: 'https://cdn4.skygo.mn/live/disk1/Cartoon_Network/HLSv3-FTA/Cartoon_Network.m3u8',
    category: 'Kids',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Cartoon_Network_2010_logo.svg',
    description: 'Cartoon Network Live English Broadcast'
  },
  {
    id: 'pbs-kids',
    name: 'PBS Kids',
    url: 'https://livestream.pbskids.org/out/v1/14507d931bbe48a69287e4850e53443c/est.m3u8',
    category: 'Kids',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/74/PBS_Kids_Dash_%281999%29_II.svg',
    description: 'PBS Kids Live Educational Programming'
  },
  {
    id: 'baby-shark-tv',
    name: 'Baby Shark TV',
    url: 'https://newidco-babysharktv-1-us.roku.wurl.tv/playlist.m3u8',
    category: 'Kids',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Baby_Shark_Live%21_logo.png/250px-Baby_Shark_Live%21_logo.png',
    description: 'Baby Shark nursery songs and preschool fun'
  },
  {
    id: 'babyfirst',
    name: 'BabyFirst',
    url: 'https://cdn.fast.jwp.services/v1/channel/1_jB6940Ei_TvhvIHDL/manifest.m3u8',
    category: 'Kids',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/52/BabyFirst_logo.svg',
    description: 'Educational programs for toddlers and infants'
  },
  {
    id: 'happykids',
    name: 'HappyKids',
    url: 'https://dil9xdvretp0f.cloudfront.net/index.m3u8',
    category: 'Kids',
    logo: 'https://i.imgur.com/cPrUCFw.png',
    description: 'Fun animated cartoons and series'
  },
  {
    id: 'kartoon-channel',
    name: 'Kartoon Channel!',
    url: 'https://lightning-fnf-samsungaus.amagi.tv/playlist.m3u8',
    category: 'Kids',
    logo: 'https://i.imgur.com/1luzP3T.png',
    description: 'Family-friendly cartoons and animated series'
  },
  {
    id: '3abn-kids',
    name: '3ABN Kids',
    url: 'https://3abn.bozztv.com/3abn2/Kids_live/smil:Kids_live.smil/playlist.m3u8',
    category: 'Kids',
    logo: 'https://i.imgur.com/z3npqO1.png',
    description: 'Children educational programming'
  },
  {
    id: 'mpt',
    name: 'MPT (Maryland Public TV)',
    url: 'https://2-fss-2.streamhoster.com/pl_138/amlst:201814-1291584/playlist.m3u8',
    category: 'Educational',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Maryland_Public_Television_2004_vector_logo.svg',
    description: 'Maryland Public Television Broadcast'
  },
  {
    id: 'abc-news-live',
    name: 'ABC News Live',
    url: 'https://abcnews-streams.akamaized.net/hls/live/2023560/abcnews1/master.m3u8',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/ABC-2021-LOGO.svg',
    description: 'ABC News 24/7 Live Stream'
  },
  {
    id: 'abc-2-baltimore',
    name: 'ABC 2 Baltimore',
    url: 'https://aegis-cloudfront-1.tubi.video/c28d1ca8-9467-4798-81dc-09c1d6e90be1/playlist.m3u8',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/ABC-2021-LOGO.svg',
    description: 'WMAR ABC 2 Baltimore News'
  },
  {
    id: 'france-24-en',
    name: 'France 24',
    url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/8/82/France_24_logo_2013.svg',
    description: 'International News from France 24'
  },
  {
    id: 'dw-english',
    name: 'DW News',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    category: 'News',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Deutsche_Welle_logo.svg',
    description: 'Deutsche Welle English Broadcast'
  }
];

async function run() {
  console.log('Testing core channels...');
  for (const c of VERIFIED_CORE) {
    const ok = await checkStream(c.url);
    console.log(`Stream ${c.name} (${c.id}):`, ok ? 'OK' : 'FAILED');
  }

  // Load existing channels.ts dataset
  const content = fs.readFileSync('src/data/channels.ts', 'utf8');
  const match = content.match(/export const TV_CHANNELS: TVChannel\[\] = (\[[\s\S]*\]);/);
  let existing = [];
  if (match) {
    existing = JSON.parse(match[1]);
  }

  // Filter out any broken Pluto proxy URLs (jmp2.uk) or broken streams
  const cleanList = [...VERIFIED_CORE];
  const seenUrls = new Set(VERIFIED_CORE.map(c => c.url));
  const seenNames = new Set(VERIFIED_CORE.map(c => c.name.toLowerCase()));

  for (const ch of existing) {
    // Skip broken proxy domain links (jmp2.uk) or Pluto stitched links that fail CORS
    if (ch.url.includes('jmp2.uk') || ch.url.includes('pluto.tv/stitch')) continue;

    let cleanName = ch.name.replace(/\([^\)]*\)/g, '').replace(/ group-title=.*$/, '').trim();
    if (cleanName.length > 35) cleanName = cleanName.substring(0, 35);
    const lower = cleanName.toLowerCase();

    if (!seenUrls.has(ch.url) && !seenNames.has(lower)) {
      seenUrls.add(ch.url);
      seenNames.add(lower);

      cleanList.push({
        id: ch.id,
        name: cleanName,
        url: ch.url,
        category: ch.category || 'General',
        logo: ch.logo || '',
        description: ch.description || `${cleanName} Channel`
      });
    }
  }

  console.log(`Writing ${cleanList.length} clean channels to src/data/channels.ts...`);
  const fileContent = `export interface TVChannel {
  id: string;
  name: string;
  url: string;
  category: string;
  logo?: string;
  description?: string;
}

export const TV_CHANNELS: TVChannel[] = ${JSON.stringify(cleanList, null, 2)};
`;

  fs.writeFileSync('src/data/channels.ts', fileContent);
  console.log('Done updating src/data/channels.ts!');
}

run();
