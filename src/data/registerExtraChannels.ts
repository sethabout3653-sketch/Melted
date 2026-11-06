import { TV_CHANNELS, type TVChannel } from './channels';

// Public HLS streams are gathered from the IPTV-org public stream index and broadcaster endpoints.
// Availability, CORS, and regional restrictions can change; the guide/player cannot guarantee every feed works in every country.
const logo = (channelId: string) => `https://images.iptv-org.github.io/epg/logos/${channelId}.png`;

const EXTRA_TV_CHANNELS: TVChannel[] = [
  {
    id: 'pbs-mpt-baltimore', name: 'MPT',
    url: 'https://2-fss-2.streamhoster.com/pl_138/amlst:201814-1291584/playlist.m3u8',
    category: 'Educational', logo: logo('PBS.us'), description: 'Maryland Public Television (WMPB) live stream.'
  },
  {
    id: 'pbs-kids-alaska', name: 'PBS Kids Alaska',
    url: 'https://livestream.pbskids.org/out/v1/94b88ad58fc14f84a9382341f1c00b82/akst.m3u8',
    category: 'Kids', logo: logo('PBSKidsAlaska.us'), description: 'PBS Kids live feed for Alaska; availability may vary by region.'
  },
  {
    id: 'pbs-kids-east-central', name: 'PBS Kids Eastern/Central',
    url: 'https://2-fss-2.streamhoster.com/pl_140/amlst:200914-1298290/playlist.m3u8',
    category: 'Kids', logo: logo('PBSKidsEasternCentral.us'), description: 'PBS Kids live feed for Eastern/Central time zones.'
  },
  {
    id: 'pbs-kids-mountain', name: 'PBS Kids Mountain',
    url: 'https://livestream.pbskids.org/out/v1/3fe3030a2c8045a3932f4289d9eba3e6/mst.m3u8',
    category: 'Kids', logo: logo('PBSKidsMountain.us'), description: 'PBS Kids live feed for the Mountain time zone.'
  },
  {
    id: 'pbs-kids-pacific', name: 'PBS Kids Pacific',
    url: 'https://livestream.pbskids.org/out/v1/11f2e6b73eaa4887b3746cb863960e79/pst.m3u8',
    category: 'Kids', logo: logo('PBSKidsPacific.us'), description: 'PBS Kids live feed for the Pacific time zone.'
  },
  {
    id: 'pbs-ket-kentucky', name: 'PBS KET Kentucky',
    url: 'https://2-fss-2.streamhoster.com/pl_132/amlst:200914-1315486/playlist.m3u8',
    category: 'Educational', logo: logo('KentuckyEducationalTelevision.us'), description: 'Kentucky Educational Television live stream.'
  },
  {
    id: 'pbs-ket-world', name: 'PBS KET World',
    url: 'https://2-fss-1.streamhoster.com/pl_122/amlst:200914-2942150/playlist.m3u8',
    category: 'Educational', logo: logo('KentuckyEducationalTelevision.us'), description: 'KET World public television stream.'
  },
  {
    id: 'qvc-2-live', name: 'QVC 2',
    url: 'https://qvc-amd-live.akamaized.net/hls/live/2034113/lsqvc2us/master.m3u8',
    category: 'Shopping', logo: logo('QVC2.us'), description: 'QVC 2 live stream; primarily intended for US viewers.'
  },
  {
    id: 'qvc-3-live', name: 'QVC 3',
    url: 'https://qvc-amd-live.akamaized.net/hls/live/2034113/lsqvc3us/master.m3u8',
    category: 'Shopping', logo: logo('QVC3.us'), description: 'QVC 3 live stream; primarily intended for US viewers.'
  },
  {
    id: 'france-24-english-live', name: 'France 24 English',
    url: 'https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_5000.m3u8',
    category: 'News', logo: logo('France24.fr'), description: 'Official France 24 English live stream; regional availability may vary.'
  },
  {
    id: 'france-24-arabic-live', name: 'France 24 Arabic',
    url: 'https://live.france24.com/hls/live/2037222/F24_AR_HI_HLS/master_5000.m3u8',
    category: 'News', logo: logo('France24.fr'), description: 'Official France 24 Arabic live stream; regional availability may vary.'
  },
  {
    id: 'dw-english-live', name: 'DW English',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8',
    category: 'News', logo: logo('DW.de'), description: 'Deutsche Welle English live stream.'
  },
  {
    id: 'dw-arabic-live', name: 'DW Arabic',
    url: 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8',
    category: 'News', logo: logo('DW.de'), description: 'Deutsche Welle Arabic live stream.'
  },
  {
    id: 'cgtn-english-live', name: 'CGTN English',
    url: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',
    category: 'News', logo: logo('CGTN.cn'), description: 'CGTN English news live stream.'
  },
  {
    id: 'cgtn-arabic-live', name: 'CGTN Arabic',
    url: 'https://news.cgtn.com/resource/live/arabic/cgtn-a.m3u8',
    category: 'News', logo: logo('CGTNArabic.cn'), description: 'CGTN Arabic live stream; may be scheduled programming rather than continuous live news.'
  },
  {
    id: 'cgtn-spanish-live', name: 'CGTN Español',
    url: 'https://news.cgtn.com/resource/live/espanol/cgtn-e.m3u8',
    category: 'News', logo: logo('CGTNSpanish.cn'), description: 'CGTN Spanish-language live stream.'
  },
  {
    id: 'cgtn-french-live', name: 'CGTN Français',
    url: 'https://news.cgtn.com/resource/live/french/cgtn-f.m3u8',
    category: 'News', logo: logo('CGTNFrench.cn'), description: 'CGTN French-language live stream; feed may not be live 24/7.'
  },
  {
    id: 'cgtn-russian-live', name: 'CGTN Русский',
    url: 'https://news.cgtn.com/resource/live/russian/cgtn-r.m3u8',
    category: 'News', logo: logo('CGTNRussian.cn'), description: 'CGTN Russian-language live stream.'
  },
  {
    id: 'cgtn-documentary-live', name: 'CGTN Documentary',
    url: 'https://news.cgtn.com/resource/live/document/cgtn-doc.m3u8',
    category: 'Documentary', logo: logo('CGTNDocumentary.cn'), description: 'CGTN documentary stream; availability may be intermittent.'
  },
  {
    id: 'al-jazeera-english-live', name: 'Al Jazeera English',
    url: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
    category: 'News', logo: logo('AlJazeera.qa'), description: 'Al Jazeera English live stream.'
  },
  {
    id: 'nhk-world-japan-live', name: 'NHK World-Japan',
    url: 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8',
    category: 'News', logo: logo('NHKWorldJapan.jp'), description: 'NHK World-Japan international live stream.'
  },
  {
    id: 'arirang-tv-live', name: 'Arirang TV',
    url: 'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8',
    category: 'Entertainment', logo: logo('ArirangTV.kr'), description: 'Arirang Television international stream.'
  },
  {
    id: 'newsmax-2-live', name: 'Newsmax 2',
    url: 'https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8',
    category: 'News', logo: logo('Newsmax2.us'), description: 'Newsmax 2 live stream; US availability may apply.'
  },
  {
    id: 'newsmax-tv-live', name: 'Newsmax TV',
    url: 'https://nmx1ota.akamaized.net/hls/live/2107010/Live_1/index.m3u8',
    category: 'News', logo: logo('NewsmaxTV.us'), description: 'Newsmax TV live stream; availability may vary by region.'
  },
  {
    id: 'oan-plus-live', name: 'OAN Plus',
    url: 'https://oan-plus-tcl.amagi.tv/playlist.m3u8',
    category: 'News', logo: logo('OANPlus.us'), description: 'OAN Plus free streaming channel.'
  },
  {
    id: 'bloomberg-originals-live', name: 'Bloomberg Originals',
    url: 'https://www.bloomberg.com/media-manifest/streams/qt.m3u8',
    category: 'News', logo: logo('BloombergOriginals.us'), description: 'Bloomberg Originals live programming; playback may depend on region and browser access.'
  },
  {
    id: 'bloomberg-us-live', name: 'Bloomberg TV US',
    url: 'https://www.bloomberg.com/media-manifest/streams/us.m3u8',
    category: 'News', logo: logo('BloombergTV.us'), description: 'Bloomberg TV US live stream; playback availability may vary.'
  },
  {
    id: 'buzzr-live', name: 'BUZZR',
    url: 'https://buzzrota-ono.amagi.tv/playlist.m3u8',
    category: 'Entertainment', logo: logo('Buzzr.us'), description: 'BUZZR classic game-show channel.'
  },
  {
    id: 'euronews-english-live', name: 'Euronews English',
    url: 'https://aegis-cloudfront-1.tubi.video/b1c4d439-03a5-4c40-ae9d-90a183e010c9/euronews-en.m3u8',
    category: 'News', logo: logo('EuronewsEnglish.fr'), description: 'Euronews English stream via Tubi; service and regional availability may vary.'
  },
  {
    id: 'reuters-now-live', name: 'Reuters Now',
    url: 'https://amg00453-reuters-amg00453c1-xumo-us-2073.playouts.now.amagi.tv/reuters-reuters-hls/playlist.m3u8',
    category: 'News', logo: logo('ReutersTV.us'), description: 'Reuters Now live news stream.'
  }
];

// Put the added channels first so they're immediately visible in the long guide, then keep the existing channels.
const existingIds = new Set(TV_CHANNELS.map(channel => channel.id));
export const CHANNEL_GUIDE: TVChannel[] = [
  ...EXTRA_TV_CHANNELS.filter(channel => !existingIds.has(channel.id)),
  ...TV_CHANNELS
];
