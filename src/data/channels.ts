export interface TVChannel {
  id: string;
  name: string;
  url: string;
  category: string;
  logo?: string;
  description?: string;
}

export const TV_CHANNELS: TVChannel[] = [
  {
    id: 'pbs-mpt-baltimore', name: 'MPT',
    url: 'https://2-fss-2.streamhoster.com/pl_138/amlst:201814-1291584/playlist.m3u8',
    category: 'Lifestyle', logo: 'https://images.iptv-org.github.io/epg/logos/PBS.us.png', description: 'Maryland Public Television (WMPB) live stream.'
  },
  {
    id: 'qvc-2-live', name: 'QVC 2',
    url: 'https://qvc-amd-live.akamaized.net/hls/live/2034113/lsqvc2us/master.m3u8',
    category: 'Lifestyle', logo: 'https://images.iptv-org.github.io/epg/logos/QVC2.us.png', description: 'QVC 2 live stream; primarily intended for US viewers.'
  },
  {
    id: 'qvc-3-live', name: 'QVC 3',
    url: 'https://qvc-amd-live.akamaized.net/hls/live/2034113/lsqvc3us/master.m3u8',
    category: 'Lifestyle', logo: 'https://images.iptv-org.github.io/epg/logos/QVC3.us.png', description: 'QVC 3 live stream; primarily intended for US viewers.'
  },
  {
    id: 'france-24-english-live', name: 'France 24 English',
    url: 'https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_5000.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/France24.fr.png', description: 'Official France 24 English live stream; regional availability may vary.'
  },
  {
    id: 'france-24-arabic-live', name: 'France 24 Arabic',
    url: 'https://live.france24.com/hls/live/2037222/F24_AR_HI_HLS/master_5000.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/France24.fr.png', description: 'Official France 24 Arabic live stream; regional availability may vary.'
  },
  {
    id: 'dw-english-live', name: 'DW English',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/DW.de.png', description: 'Deutsche Welle English live stream.'
  },
  {
    id: 'dw-arabic-live', name: 'DW Arabic',
    url: 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/DW.de.png', description: 'Deutsche Welle Arabic live stream.'
  },
  {
    id: 'cgtn-english-live', name: 'CGTN English',
    url: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/CGTN.cn.png', description: 'CGTN English news live stream.'
  },
  {
    id: 'cgtn-arabic-live', name: 'CGTN Arabic',
    url: 'https://news.cgtn.com/resource/live/arabic/cgtn-a.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/CGTNArabic.cn.png', description: 'CGTN Arabic live stream; may be scheduled programming rather than continuous live news.'
  },
  {
    id: 'cgtn-spanish-live', name: 'CGTN Español',
    url: 'https://news.cgtn.com/resource/live/espanol/cgtn-e.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/CGTNSpanish.cn.png', description: 'CGTN Spanish-language live stream.'
  },
  {
    id: 'cgtn-french-live', name: 'CGTN Français',
    url: 'https://news.cgtn.com/resource/live/french/cgtn-f.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/CGTNFrench.cn.png', description: 'CGTN French-language live stream; feed may not be live 24/7.'
  },
  {
    id: 'cgtn-russian-live', name: 'CGTN Русский',
    url: 'https://news.cgtn.com/resource/live/russian/cgtn-r.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/CGTNRussian.cn.png', description: 'CGTN Russian-language live stream.'
  },
  {
    id: 'cgtn-documentary-live', name: 'CGTN Documentary',
    url: 'https://news.cgtn.com/resource/live/document/cgtn-doc.m3u8',
    category: 'Lifestyle', logo: 'https://images.iptv-org.github.io/epg/logos/CGTNDocumentary.cn.png', description: 'CGTN documentary stream; availability may be intermittent.'
  },
  {
    id: 'al-jazeera-english-live', name: 'Al Jazeera English',
    url: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/AlJazeera.qa.png', description: 'Al Jazeera English live stream.'
  },
  {
    id: 'nhk-world-japan-live', name: 'NHK World-Japan',
    url: 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/NHKWorldJapan.jp.png', description: 'NHK World-Japan international live stream.'
  },
  {
    id: 'arirang-tv-live', name: 'Arirang TV',
    url: 'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8',
    category: 'Entertainment', logo: 'https://images.iptv-org.github.io/epg/logos/ArirangTV.kr.png', description: 'Arirang Television international stream.'
  },
  {
    id: 'newsmax-2-live', name: 'Newsmax 2',
    url: 'https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/Newsmax2.us.png', description: 'Newsmax 2 live stream; US availability may apply.'
  },
  {
    id: 'newsmax-tv-live', name: 'Newsmax TV',
    url: 'https://nmx1ota.akamaized.net/hls/live/2107010/Live_1/index.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/NewsmaxTV.us.png', description: 'Newsmax TV live stream; availability may vary by region.'
  },
  {
    id: 'oan-plus-live', name: 'OAN Plus',
    url: 'https://oan-plus-tcl.amagi.tv/playlist.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/OANPlus.us.png', description: 'OAN Plus free streaming channel.'
  },
  {
    id: 'bloomberg-originals-live', name: 'Bloomberg Originals',
    url: 'https://www.bloomberg.com/media-manifest/streams/qt.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/BloombergOriginals.us.png', description: 'Bloomberg Originals live programming; playback may depend on region and browser access.'
  },
  {
    id: 'bloomberg-us-live', name: 'Bloomberg TV US',
    url: 'https://www.bloomberg.com/media-manifest/streams/us.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/BloombergTV.us.png', description: 'Bloomberg TV US live stream; playback availability may vary.'
  },
  {
    id: 'buzzr-live', name: 'BUZZR',
    url: 'https://buzzrota-ono.amagi.tv/playlist.m3u8',
    category: 'Entertainment', logo: 'https://images.iptv-org.github.io/epg/logos/Buzzr.us.png', description: 'BUZZR classic game-show channel.'
  },
  {
    id: 'euronews-english-live', name: 'Euronews English',
    url: 'https://aegis-cloudfront-1.tubi.video/b1c4d439-03a5-4c40-ae9d-90a183e010c9/euronews-en.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/EuronewsEnglish.fr.png', description: 'Euronews English stream via Tubi; service and regional availability may vary.'
  },
  {
    id: 'reuters-now-live', name: 'Reuters Now',
    url: 'https://amg00453-reuters-amg00453c1-xumo-us-2073.playouts.now.amagi.tv/reuters-reuters-hls/playlist.m3u8',
    category: 'News', logo: 'https://images.iptv-org.github.io/epg/logos/ReutersTV.us.png', description: 'Reuters Now live news stream.'
  },
{
  "id": "wbff-fox-45",
  "name": "FOX 45 Baltimore",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fcsm-e-cesinclairlusordlive-109260485.bln1.yospace.com%2Fcsm%2Fextlive%2Fsbgtvprd01%2Cwbff-fast-hls-1080p-amg.m3u8%3Fyo.oh%3DY3NtLWUtc2luY2xhaXItbGl2ZS11c2UxLWViLmJsbjEueW9zcGFjZS5jb20%3D",
  "category": "News",
  "logo": "https://play-lh.googleusercontent.com/ergVDljVAJ6rn3BY7iWEtAJxe0HwoYyuwvhfzZitO0wTVaMEYOo0lvNDlKnYsMtpu-_sQwnVQyamh2uMIwlNDg",
  "description": "FOX 45 Baltimore live stream."
},
{
  "id": "afv-always-funny",
  "name": "AFV - Always Funny",
  "url": "https://d24l3uppudokci.cloudfront.net/playlist.m3u8",
  "category": "Comedy",
  "logo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREfL-tDHoqStqwHslISGhJAJkmvqnpYyfw2YmeLUdB_ZxQ33l_eeCLw4u9&s=10",
  "description": "AFV Always Funny Videos - Hilarious bloopers, fails, and family home videos."
},
{
  "id": "roar-channel",
  "name": "ROAR",
  "url": "https://fast-channels.sinclairstoryline.com/TBD/index.m3u8",
  "category": "Entertainment",
  "logo": "https://cdn.mos.cms.futurecdn.net/VVjVXoCGpgFH2XHs76j7nX.png",
  "description": "ROAR Live Entertainment & Viral Series"
},
{
  "id": "comedy-dynamics",
  "name": "Comedy Dynamics",
  "url": "https://d3a5mry3t5fzw9.cloudfront.net/playlist.m3u8",
  "category": "Comedy",
  "logo": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 80\" width=\"160\" height=\"80\"><rect width=\"160\" height=\"80\" rx=\"8\" fill=\"%230c1726\"/><path d=\"M40 24a8 8 0 0 1 16 0v16a8 8 0 0 1-16 0z\" fill=\"%2338bdf8\"/><path d=\"M34 38a14 14 0 0 0 28 0h-4a10 10 0 0 1-20 0z\" fill=\"%2338bdf8\"/><text x=\"70\" y=\"38\" fill=\"%23ffffff\" font-family=\"system-ui,sans-serif\" font-weight=\"900\" font-size=\"16\" letter-spacing=\"1\">COMEDY</text><text x=\"70\" y=\"54\" fill=\"%2338bdf8\" font-family=\"system-ui,sans-serif\" font-weight=\"700\" font-size=\"12\" letter-spacing=\"2\">DYNAMICS</text></svg>",
  "description": "Stand-up comedy specials and routines from world-class comedians."
},
{
  "id": "dry-bar-comedy",
  "name": "Dry Bar Comedy",
  "url": "https://drybar-drybarcomedy-1-us.samsung.wurl.tv/playlist.m3u8",
  "category": "Comedy",
  "logo": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 80\" width=\"160\" height=\"80\"><rect width=\"160\" height=\"80\" rx=\"8\" fill=\"%2318181b\"/><circle cx=\"36\" cy=\"40\" r=\"20\" fill=\"%23f59e0b\"/><text x=\"36\" y=\"47\" text-anchor=\"middle\" fill=\"%23000000\" font-family=\"system-ui,sans-serif\" font-weight=\"900\" font-size=\"20\">D</text><text x=\"68\" y=\"36\" fill=\"%23f59e0b\" font-family=\"system-ui,sans-serif\" font-weight=\"900\" font-size=\"17\" letter-spacing=\"1\">DRY BAR</text><text x=\"68\" y=\"53\" fill=\"%23e4e4e7\" font-family=\"system-ui,sans-serif\" font-weight=\"900\" font-size=\"13\" letter-spacing=\"2\">COMEDY</text></svg>",
  "description": "Clean stand-up comedy specials from hilarious touring comics."
},
{
  "id": "cbc-comedy",
  "name": "CBC Comedy",
  "url": "https://amagi-streams.akamaized.net/hls/live/2110963/cbccomedy/master.m3u8",
  "category": "Comedy",
  "logo": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 80\" width=\"160\" height=\"80\"><rect width=\"160\" height=\"80\" rx=\"8\" fill=\"%231c0a0a\"/><circle cx=\"36\" cy=\"40\" r=\"14\" fill=\"%23dc2626\"/><circle cx=\"36\" cy=\"40\" r=\"8\" fill=\"%23ffffff\"/><circle cx=\"36\" cy=\"40\" r=\"4\" fill=\"%23dc2626\"/><text x=\"64\" y=\"37\" fill=\"%23ffffff\" font-family=\"system-ui,sans-serif\" font-weight=\"900\" font-size=\"20\" letter-spacing=\"1\">CBC</text><text x=\"64\" y=\"54\" fill=\"%23ef4444\" font-family=\"system-ui,sans-serif\" font-weight=\"700\" font-size=\"13\" letter-spacing=\"1.5\">COMEDY</text></svg>",
  "description": "Top comedy series, sketches, and stand-up routines."
},
{
  "id": "cartoon-network-en",
  "name": "Cartoon Network",
  "url": "https://cdn4.skygo.mn/live/disk1/Cartoon_Network/HLSv3-FTA/Cartoon_Network.m3u8",
  "category": "Kids",
  "logo": "https://upload.wikimedia.org/wikipedia/commons/8/80/Cartoon_Network_2010_logo.svg",
  "description": "Cartoon Network Live English Broadcast"
},
{
  "id": "pbs-kids",
  "name": "PBS Kids",
  "url": "https://livestream.pbskids.org/out/v1/14507d931bbe48a69287e4850e53443c/est.m3u8",
  "category": "Family",
  "logo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTX0Cy8Om2kCYAkojjgCvXc_Fc-2l-CGhTwhwHtLfdO-YBbiGlY5Wy8bMA&s=10",
  "description": "PBS Kids Live Educational Programming"
},
{
  "id": "baby-shark-tv",
  "name": "Baby Shark TV",
  "url": "https://newidco-babysharktv-1-us.roku.wurl.tv/playlist.m3u8",
  "category": "Family",
  "logo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRze7KNswWV-ifpStKVfPWC0y-S3o_t7ZMfkB9JgRwhyQFBRHdTbiJlgOAG&s=10",
  "description": "Baby Shark nursery songs and preschool fun"
},
{
  "id": "babyfirst",
  "name": "BabyFirst",
  "url": "https://cdn.fast.jwp.services/v1/channel/1_jB6940Ei_TvhvIHDL/manifest.m3u8",
  "category": "Family",
  "logo": "https://upload.wikimedia.org/wikipedia/ru/d/d0/Babyfirst-logo.png?utm_source=ru.wikipedia.org&utm_campaign=index&utm_content=original",
  "description": "Educational programs for toddlers and infants"
},
{
  "id": "pluto-nick-pluto-tv",
  "name": "Nickelodeon",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ca673e0d0bd6c2689c94ce3.m3u8",
  "category": "Kids",
  "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Nickelodeon_2023_logo.svg/1920px-Nickelodeon_2023_logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail&_=20250829232756",
  "description": "Nickelodeon Pluto TV live on Pluto TV"
},
{
  "id": "pluto-nick-jr-pluto-tv-ptv1",
  "name": "Nick Jr.",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ca6748a37b88b269472dad9.m3u8",
  "category": "Family",
  "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Nick_Jr._logo_2023.svg/1280px-Nick_Jr._logo_2023.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail&_=20250701043845",
  "description": "Nick Jr. Pluto TV live on Pluto TV"
},
{
  "id": "pluto-comedy-central-pluto-tv",
  "name": "Comedy Central",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ca671f215a62078d2ec0abf.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/5ca671f215a62078d2ec0abf/colorLogoPNG_1785343315719.png",
  "description": "Comedy Central Pluto TV live on Pluto TV"
},
{
  "id": "pluto-totally-turtles",
  "name": "Nicktoons",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d0c16d686454ead733d08f8.m3u8",
  "category": "Kids",
  "logo": "https://upload.wikimedia.org/wikipedia/commons/9/97/Nicktoons_logo_%282023%29.svg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original",
  "description": "TOTALLY TURTLES live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-comedy",
  "name": "Pluto TV Comedy",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5a4d3a00ad95e4718ae8d8db.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5a4d3a00ad95e4718ae8d8db/colorLogoPNG_1731836724642.png",
  "description": "Pluto TV Comedy live on Pluto TV"
},
{
  "id": "pluto-little-stars-universe",
  "name": "Little Stars Universe",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-51c75f7bb6f26ba1cd00002f.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/51c75f7bb6f26ba1cd00002f/colorLogoPNG.png",
  "description": "Little Stars Universe live on Pluto TV"
},
{
  "id": "pluto-cnn-headlines",
  "name": "CNN HEADLINES",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5421f71da6af422839419cb3.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5421f71da6af422839419cb3/colorLogoPNG_1755034025681.png",
  "description": "CNN HEADLINES live on Pluto TV"
},
{
  "id": "pluto-mst3k",
  "name": "MST3K",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-545943f1c9f133a519bbac92.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/545943f1c9f133a519bbac92/colorLogoPNG.png",
  "description": "MST3K live on Pluto TV"
},
{
  "id": "pluto-scripps-news",
  "name": "Scripps News",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5459795fc9f133a519bc0bef.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5459795fc9f133a519bc0bef/colorLogoPNG.png",
  "description": "Scripps News live on Pluto TV"
},
{
  "id": "pluto-bloomberg-tv",
  "name": "Bloomberg TV+",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-54ff7ba69222cb1c2624c584.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/54ff7ba69222cb1c2624c584/colorLogoPNG_1756948295813.png",
  "description": "Bloomberg TV+ live on Pluto TV"
},
{
  "id": "pluto-failarmy",
  "name": "FailArmy",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-554158e864526b29254ff105.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/554158e864526b29254ff105/colorLogoPNG.png",
  "description": "FailArmy live on Pluto TV"
},
{
  "id": "pluto-newsmax2",
  "name": "Newsmax2",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-55b179af994403942f3061d6.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/55b179af994403942f3061d6/colorLogoPNG.png",
  "description": "Newsmax2 live on Pluto TV"
},
{
  "id": "pluto-sky-news",
  "name": "Sky News",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-55b285cd2665de274553d66f.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/55b285cd2665de274553d66f/colorLogoPNG.png",
  "description": "Sky News live on Pluto TV"
},
{
  "id": "pluto-world-poker-tour",
  "name": "World Poker Tour",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5616f9c0ada51f8004c4b091.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5616f9c0ada51f8004c4b091/colorLogoPNG-1664295222280.png",
  "description": "World Poker Tour live on Pluto TV"
},
{
  "id": "pluto-forever-kids",
  "name": "Forever Kids",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-56171fafada51f8004c4b40f.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/56171fafada51f8004c4b40f/colorLogoPNG.png",
  "description": "Forever Kids live on Pluto TV"
},
{
  "id": "pluto-classic-movies-channel",
  "name": "Classic Movies Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-561c5b0dada51f8004c4d855.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/561c5b0dada51f8004c4d855/colorLogoPNG_1759790242932.png",
  "description": "Classic Movies Channel live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-action",
  "name": "Pluto TV Action",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-561d7d484dc7c8770484914a.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/561d7d484dc7c8770484914a/colorLogoPNG.png",
  "description": "Pluto TV Action live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-science",
  "name": "Pluto TV Science",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-563a970aa1a1f7fe7c9daad7.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/563a970aa1a1f7fe7c9daad7/colorLogoPNG.png",
  "description": "Pluto TV Science live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-horror",
  "name": "Pluto TV Horror",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-569546031a619b8f07ce6e25.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/569546031a619b8f07ce6e25/colorLogoPNG.png",
  "description": "Pluto TV Horror live on Pluto TV"
},
{
  "id": "pluto-funny-af",
  "name": "Funny AF",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-580e87ff497c73ba2f321dd3.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/580e87ff497c73ba2f321dd3/colorLogoPNG.png",
  "description": "Funny AF live on Pluto TV"
},
{
  "id": "pluto-cars",
  "name": "Pluto TV Cars",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5812b3a4249444e05d09cc46.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5812b3a4249444e05d09cc46/colorLogoPNG.png",
  "description": "Pluto TV Cars live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-anime-1-ptv1",
  "name": "Pluto TV Anime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5812b7d3249444e05d09cc49.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/5812b7d3249444e05d09cc49/colorLogoPNG_1748797351518.png",
  "description": "Pluto TV Anime live on Pluto TV"
},
{
  "id": "pluto-spike",
  "name": "Spike Pluto TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5812bcc8237a6ff45d16c407.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5812bcc8237a6ff45d16c407/colorLogoPNG.png",
  "description": "Spike Pluto TV live on Pluto TV"
},
{
  "id": "pluto-naturescape",
  "name": "Naturescape",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5812bd9f249444e05d09cc4e.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5812bd9f249444e05d09cc4e/colorLogoPNG.png",
  "description": "Naturescape live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-true-crime",
  "name": "Pluto TV True Crime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5812be1c249444e05d09cc50.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5812be1c249444e05d09cc50/colorLogoPNG.png",
  "description": "Pluto TV True Crime live on Pluto TV"
},
{
  "id": "pluto-buzzr",
  "name": "BUZZR",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5812bfbe4ced4f7b601b12e6.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5812bfbe4ced4f7b601b12e6/colorLogoPNG.png",
  "description": "BUZZR live on Pluto TV"
},
{
  "id": "pluto-live-music",
  "name": "Live Music",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5873fc21cad696fb37aa9054.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5873fc21cad696fb37aa9054/colorLogoPNG.png",
  "description": "Live Music live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-food",
  "name": "Pluto TV Food",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5877ac8cb791f4eb4a140d81.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5877ac8cb791f4eb4a140d81/colorLogoPNG.png",
  "description": "Pluto TV Food live on Pluto TV"
},
{
  "id": "pluto-bet-cinema",
  "name": "BET Cinema",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-58af4c093a41ca9d4ecabe96.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/58af4c093a41ca9d4ecabe96/colorLogoPNG_1759338280891.png",
  "description": "BET Cinema live on Pluto TV"
},
{
  "id": "pluto-rifftrax",
  "name": "RiffTrax",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-58d947b9e420d8656ee101ab.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/58d947b9e420d8656ee101ab/colorLogoPNG.png",
  "description": "RiffTrax live on Pluto TV"
},
{
  "id": "pluto-flicks-of-fury",
  "name": "Flicks of Fury",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-58e55b14ad8e9c364d55f717.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/58e55b14ad8e9c364d55f717/colorLogoPNG.png",
  "description": "Flicks of Fury live on Pluto TV"
},
{
  "id": "pluto-tna-wrestling",
  "name": "TNA Wrestling",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-59b722526996084038c01e1b.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/59b722526996084038c01e1b/colorLogoPNG_1784129596431.png",
  "description": "TNA Wrestling live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-history",
  "name": "Pluto TV History",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5a4d35dfa5c02e717a234f86.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5a4d35dfa5c02e717a234f86/colorLogoPNG.png",
  "description": "Pluto TV History live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-romance",
  "name": "Pluto TV Romance",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5a66795ef91fef2c7031c599.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5a66795ef91fef2c7031c599/colorLogoPNG.png",
  "description": "Pluto TV Romance live on Pluto TV"
},
{
  "id": "pluto-cbs-news",
  "name": "CBS News 24/7",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5a6b92f6e22a617379789618.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5a6b92f6e22a617379789618/colorLogoPNG.png",
  "description": "CBS News 24/7 live on Pluto TV"
},
{
  "id": "pluto-fox-sports",
  "name": "FOX Sports",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5a74b8e1e22a61737979c6bf.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5a74b8e1e22a61737979c6bf/colorLogoPNG.png",
  "description": "FOX Sports live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-paranormal",
  "name": "Pluto TV Paranormal",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5adf96e3e738977e2c31cb04.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5adf96e3e738977e2c31cb04/colorLogoPNG.png",
  "description": "Pluto TV Paranormal live on Pluto TV"
},
{
  "id": "pluto-the-new-detectives",
  "name": "The New Detectives",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5aea40b35126c2157123aa64.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5aea40b35126c2157123aa64/colorLogoPNG.png",
  "description": "The New Detectives live on Pluto TV"
},
{
  "id": "pluto-nosey",
  "name": "Nosey",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5aec96ec5126c2157123c657.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5aec96ec5126c2157123c657/colorLogoPNG.png",
  "description": "Nosey live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-thrillers",
  "name": "Pluto TV Thrillers",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5b4e69e08291147bd04a9fd7.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5b4e69e08291147bd04a9fd7/colorLogoPNG.png",
  "description": "Pluto TV Thrillers live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-drama",
  "name": "Pluto TV Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5b4e92e4694c027be6ecece1.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5b4e92e4694c027be6ecece1/colorLogoPNG.png",
  "description": "Pluto TV Drama live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-westerns-ptv1",
  "name": "Pluto TV Westerns",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5b4e94282d4ec87bdcbb87cd.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5b4e94282d4ec87bdcbb87cd/colorLogoPNG.png",
  "description": "Pluto TV Westerns live on Pluto TV"
},
{
  "id": "pluto-unsolved-mysteries",
  "name": "Unsolved Mysteries",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5b4e96a0423e067bd6df6901.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5b4e96a0423e067bd6df6901/colorLogoPNG.png",
  "description": "Unsolved Mysteries live on Pluto TV"
},
{
  "id": "pluto-gordon-ramsays-hells-kitchen",
  "name": "Gordon Ramsay's Hell's Kitchen",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5b4e99f4423e067bd6df6903.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/5b4e99f4423e067bd6df6903/colorLogoPNG.png",
  "description": "Gordon Ramsay's Hell's Kitchen live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-sci-fi",
  "name": "Pluto TV Sci-Fi",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5b4fc274694c027be6ed3eea.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5b4fc274694c027be6ed3eea/colorLogoPNG.png",
  "description": "Pluto TV Sci-Fi live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-fantastic",
  "name": "Pluto TV Fantastic",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5b64a245a202b3337f09e51d.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5b64a245a202b3337f09e51d/colorLogoPNG_1756834917957.png",
  "description": "Pluto TV Fantastic live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-spotlight",
  "name": "Pluto TV Spotlight",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ba3fb9c4b078e0f37ad34e8.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5ba3fb9c4b078e0f37ad34e8/colorLogoPNG.png",
  "description": "Pluto TV Spotlight live on Pluto TV"
},
{
  "id": "pluto-the-pet-collective",
  "name": "The Pet Collective",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5bb1ad55268cae539bcedb08.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5bb1ad55268cae539bcedb08/colorLogoPNG.png",
  "description": "The Pet Collective live on Pluto TV"
},
{
  "id": "pluto-forensic-files",
  "name": "Forensic Files",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5bb1af6a268cae539bcedb0a.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/5bb1af6a268cae539bcedb0a/colorLogoPNG.png",
  "description": "Forensic Files live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-military",
  "name": "Pluto TV Military",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5bb3fea0f711fd76340eebff.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5bb3fea0f711fd76340eebff/colorLogoPNG.png",
  "description": "Pluto TV Military live on Pluto TV"
},
{
  "id": "pluto-qvc-1",
  "name": "QVC",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5bdcdf1e851dd5632e2c11d1.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5bdcdf1e851dd5632e2c11d1/colorLogoPNG.png",
  "description": "QVC live on Pluto TV"
},
{
  "id": "pluto-dog-the-bounty-hunter",
  "name": "Dog the Bounty Hunter",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5bee1a7359ee03633e780238.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5bee1a7359ee03633e780238/colorLogoPNG_1767736765611.png",
  "description": "Dog the Bounty Hunter live on Pluto TV"
},
{
  "id": "pluto-crackling-fireplace",
  "name": "Crackling Fireplace",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5bf48085851dd5632e2f7b4d.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5bf48085851dd5632e2f7b4d/colorLogoPNG.png",
  "description": "Crackling Fireplace live on Pluto TV"
},
{
  "id": "pluto-cars-1",
  "name": "Pluto TV Cars",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5c12ba66eae03059cbdc77f2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5c12ba66eae03059cbdc77f2/colorLogoPNG.png",
  "description": "Pluto TV Cars live on Pluto TV"
},
{
  "id": "pluto-tv-land-sitcoms",
  "name": "TV Land Sitcoms",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5c2d64ffbdf11b71587184b8.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/5c2d64ffbdf11b71587184b8/colorLogoPNG.png",
  "description": "TV Land Sitcoms live on Pluto TV"
},
{
  "id": "pluto-cold-case-files-presented-by-aande",
  "name": "Cold Case Files by A&E",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5c37d6712de254456f7ec340.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/5c37d6712de254456f7ec340/colorLogoPNG_1767744689997.png",
  "description": "Cold Case Files by A&E live on Pluto TV"
},
{
  "id": "pluto-spike-outdoors",
  "name": "Spike Outdoors",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5c393cad2de254456f7ef8c2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5c393cad2de254456f7ef8c2/colorLogoPNG.png",
  "description": "Spike Outdoors live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-cult-films",
  "name": "Pluto TV Cult Films",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5c665db3e6c01b72c4977bc2.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5c665db3e6c01b72c4977bc2/colorLogoPNG.png",
  "description": "Pluto TV Cult Films live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-terror",
  "name": "Pluto TV Terror",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5c6dc88fcd232425a6e0f06e.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5c6dc88fcd232425a6e0f06e/colorLogoPNG.png",
  "description": "Pluto TV Terror live on Pluto TV"
},
{
  "id": "pluto-degrassi",
  "name": "Degrassi",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5c6eeb85c05dfc257e5a50c4.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5c6eeb85c05dfc257e5a50c4/colorLogoPNG_1777484317786.png",
  "description": "Degrassi live on Pluto TV"
},
{
  "id": "pluto-80s-rewind",
  "name": "80s Rewind",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ca525b650be2571e3943c63.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5ca525b650be2571e3943c63/colorLogoPNG.png",
  "description": "80s Rewind live on Pluto TV"
},
{
  "id": "pluto-bet-pluto-tv",
  "name": "BET Pluto TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ca670f6593a5d78f0e85aed.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5ca670f6593a5d78f0e85aed/colorLogoPNG.png",
  "description": "BET Pluto TV live on Pluto TV"
},
{
  "id": "pluto-mtv-pluto-tv",
  "name": "MTV Pluto TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ca672f515a62078d2ec0ad2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5ca672f515a62078d2ec0ad2/colorLogoPNG.png",
  "description": "MTV Pluto TV live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-backcountry",
  "name": "Pluto TV Backcountry",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cabdf1437b88b26947346b2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cabdf1437b88b26947346b2/colorLogoPNG.png",
  "description": "Pluto TV Backcountry live on Pluto TV"
},
{
  "id": "pluto-paramount-movie-channel",
  "name": "Paramount Movie Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cb0cae7a461406ffe3f5213.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5cb0cae7a461406ffe3f5213/colorLogoPNG.png",
  "description": "Paramount Movie Channel live on Pluto TV"
},
{
  "id": "pluto-midsomer-murders",
  "name": "Midsomer Murders",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cbf6a868a1bce4a3d52a5e9.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5cbf6a868a1bce4a3d52a5e9/colorLogoPNG.png",
  "description": "Midsomer Murders live on Pluto TV"
},
{
  "id": "pluto-doctor-who-classic",
  "name": "Doctor Who Classic",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ce4475cd43850831ca91ce7.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5ce4475cd43850831ca91ce7/colorLogoPNG.png",
  "description": "Doctor Who Classic live on Pluto TV"
},
{
  "id": "pluto-antiques-roadshow-uk",
  "name": "Antiques Roadshow UK",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ce44810b421747ae467b7cd.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5ce44810b421747ae467b7cd/colorLogoPNG_1782832480489.png",
  "description": "Antiques Roadshow UK live on Pluto TV"
},
{
  "id": "pluto-logo-pluto-tv",
  "name": "Logo Pluto TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ce5a8954311f992edbe1da2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5ce5a8954311f992edbe1da2/colorLogoPNG_1731836723261.png",
  "description": "Logo Pluto TV live on Pluto TV"
},
{
  "id": "pluto-nfl-channel",
  "name": "NFL Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ced7d5df64be98e07ed47b6.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5ced7d5df64be98e07ed47b6/colorLogoPNG_1785344058498.png",
  "description": "NFL Channel live on Pluto TV"
},
{
  "id": "pluto-estrella-tv",
  "name": "EstrellaTV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf0622da00ca1e2f6fac712.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf0622da00ca1e2f6fac712/colorLogoPNG.png",
  "description": "EstrellaTV live on Pluto TV"
},
{
  "id": "pluto-cine-premiere",
  "name": "Cine Premiere",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf968040ab7d8f181e6a68b.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf968040ab7d8f181e6a68b/colorLogoPNG.png",
  "description": "Cine Premiere live on Pluto TV"
},
{
  "id": "pluto-cine-en-espanol",
  "name": "Cine en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf96b1c4f1ca3f0629f4bf0.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf96b1c4f1ca3f0629f4bf0/colorLogoPNG.png",
  "description": "Cine en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-investiga-ptv1",
  "name": "Investiga",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf96b8f4f1ca3f0629f4bf1.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf96b8f4f1ca3f0629f4bf1/colorLogoPNG.png",
  "description": "Investiga live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-novelas",
  "name": "Pluto TV Novelas",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf96c0222df39f1a338d163.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf96c0222df39f1a338d163/colorLogoPNG.png",
  "description": "Pluto TV Novelas live on Pluto TV"
},
{
  "id": "pluto-telemundo-telenovelas-clasicas-ptv1",
  "name": "Telemundo telenovelas cl\u00e1sicas",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf96cc422df39f1a338d165.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf96cc422df39f1a338d165/colorLogoPNG.png",
  "description": "Telemundo telenovelas cl\u00e1sicas live on Pluto TV"
},
{
  "id": "pluto-mtv-en-espanol",
  "name": "MTV en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf96d351652631e36d4331f.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf96d351652631e36d4331f/colorLogoPNG-1641928405432.png",
  "description": "MTV en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-comedy-central-en-espanol",
  "name": "Comedy Central en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5cf96dad1652631e36d43320.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5cf96dad1652631e36d43320/colorLogoPNG_1731837238379.png",
  "description": "Comedy Central en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-peppapig",
  "name": "Peppa Pig",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d14fb6c84dd37df3b4290c5.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/5d14fb6c84dd37df3b4290c5/colorLogoPNG_1730733871298.png",
  "description": "Peppa Pig live on Pluto TV"
},
{
  "id": "pluto-yo-mtv",
  "name": "Yo! MTV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d14fc31252d35decbc4080b.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d14fc31252d35decbc4080b/colorLogoPNG.png",
  "description": "Yo! MTV live on Pluto TV"
},
{
  "id": "pluto-mtv-biggest-pop",
  "name": "MTV Biggest Pop",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d14fd1a252d35decbc4080c.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d14fd1a252d35decbc4080c/colorLogoPNG_1758324914960.png",
  "description": "MTV Biggest Pop live on Pluto TV"
},
{
  "id": "pluto-mtv-spankin-new",
  "name": "MTV Spankin' New",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d14fdb8ca91eedee1633117.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d14fdb8ca91eedee1633117/colorLogoPNG.png",
  "description": "MTV Spankin' New live on Pluto TV"
},
{
  "id": "pluto-mtv-flow-latino-ptv1",
  "name": "MTV Flow Latino",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d3609cd6a6c78d7672f2a81.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d3609cd6a6c78d7672f2a81/colorLogoPNG_1731834717093.png",
  "description": "MTV Flow Latino live on Pluto TV"
},
{
  "id": "pluto-dallas-cowboys-cheerleaders",
  "name": "DCC: Making the Team",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d40855b3fb0855028c99b6f.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d40855b3fb0855028c99b6f/colorLogoPNG.png",
  "description": "DCC: Making the Team live on Pluto TV"
},
{
  "id": "pluto-tv-land-drama",
  "name": "TV Land Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d40bebc5e3d2750a2239d7e.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5d40bebc5e3d2750a2239d7e/colorLogoPNG.png",
  "description": "TV Land Drama live on Pluto TV"
},
{
  "id": "pluto-wild-n-out",
  "name": "Wild 'N Out",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d48678d34ceb37d3c458a55.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/5d48678d34ceb37d3c458a55/colorLogoPNG.png",
  "description": "Wild 'N Out live on Pluto TV"
},
{
  "id": "pluto-the-challenge",
  "name": "The Challenge",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d48685da7e9f476aa8a1888.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d48685da7e9f476aa8a1888/colorLogoPNG.png",
  "description": "The Challenge live on Pluto TV"
},
{
  "id": "pluto-the-first",
  "name": "The First",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d486acc34ceb37d3c458a64.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5d486acc34ceb37d3c458a64/colorLogoPNG.png",
  "description": "The First live on Pluto TV"
},
{
  "id": "pluto-love-and-hip-hop",
  "name": "Love & Hip Hop",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d51ddf0369acdb278dfb05e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d51ddf0369acdb278dfb05e/colorLogoPNG.png",
  "description": "Love & Hip Hop live on Pluto TV"
},
{
  "id": "pluto-black-ink-crew",
  "name": "Black Ink Crew",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d51e2bceca5b4b2c0e06c50.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d51e2bceca5b4b2c0e06c50/colorLogoPNG_1731835399139.png",
  "description": "Black Ink Crew live on Pluto TV"
},
{
  "id": "pluto-this-old-house",
  "name": "This Old House",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d51e791b7dba3b2ae990ab2.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5d51e791b7dba3b2ae990ab2/colorLogoPNG.png",
  "description": "This Old House live on Pluto TV"
},
{
  "id": "pluto-today-1",
  "name": "TODAY All Day",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d695f7db53adf96b78e7ce3.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5d695f7db53adf96b78e7ce3/colorLogoPNG.png",
  "description": "TODAY All Day live on Pluto TV"
},
{
  "id": "pluto-the-addams-family",
  "name": "The Addams Family",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d81607ab737153ea3c1c80e.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5d81607ab737153ea3c1c80e/colorLogoPNG.png",
  "description": "The Addams Family live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-lives",
  "name": "Pluto TV Lives",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d8beeb39b5d5d5f8c672530.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d8beeb39b5d5d5f8c672530/colorLogoPNG.png",
  "description": "Pluto TV Lives live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-reality",
  "name": "Pluto TV Reality",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d8bf0b06d2d855ee15115e3.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/5d8bf0b06d2d855ee15115e3/colorLogoPNG.png",
  "description": "Pluto TV Reality live on Pluto TV"
},
{
  "id": "pluto-nick-en-espanol",
  "name": "Nickelodeon en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d8d08395f39465da6fb3ec4.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/5d8d08395f39465da6fb3ec4/colorLogoPNG.png",
  "description": "Nickelodeon en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-cine-adrenalina",
  "name": "Cine adrenalina",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d8d164d92e97a5e107638d2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d8d164d92e97a5e107638d2/colorLogoPNG.png",
  "description": "Cine adrenalina live on Pluto TV"
},
{
  "id": "pluto-cine-terror",
  "name": "Cine terror",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d8d180092e97a5e107638d3.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d8d180092e97a5e107638d3/colorLogoPNG.png",
  "description": "Cine terror live on Pluto TV"
},
{
  "id": "pluto-vevo-pop",
  "name": "Vevo Pop",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d93b635b43dd1a399b39eee.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d93b635b43dd1a399b39eee/colorLogoPNG.png",
  "description": "Vevo Pop live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-mistletoe",
  "name": "Pluto TV Mistletoe",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5d9ccd538661290009ecbdb7.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5d9ccd538661290009ecbdb7/colorLogoPNG_1792768625587.png",
  "description": "Pluto TV Mistletoe live on Pluto TV"
},
{
  "id": "pluto-naruto",
  "name": "Naruto",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5da0c85bd2c9c10009370984.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/5da0c85bd2c9c10009370984/colorLogoPNG.png",
  "description": "Naruto live on Pluto TV"
},
{
  "id": "pluto-vevo-country",
  "name": "Vevo Country",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5da0d75e84830900098a1ea0.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5da0d75e84830900098a1ea0/colorLogoPNG.png",
  "description": "Vevo Country live on Pluto TV"
},
{
  "id": "pluto-vevo-randb",
  "name": "Vevo R&B",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5da0d83f66c9700009b96d0e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5da0d83f66c9700009b96d0e/colorLogoPNG.png",
  "description": "Vevo R&B live on Pluto TV"
},
{
  "id": "pluto-tosh-1",
  "name": "Tosh.0",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dae084727c8af0009fe40a4.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/5dae084727c8af0009fe40a4/colorLogoPNG_1731837283801.png",
  "description": "Tosh.0 live on Pluto TV"
},
{
  "id": "pluto-court-tv-1",
  "name": "Court TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dae0b4841a7d0000938ddbd.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5dae0b4841a7d0000938ddbd/colorLogoPNG.png",
  "description": "Court TV live on Pluto TV"
},
{
  "id": "pluto-kids-movie-club",
  "name": "Kids Movie Club",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5db0ad56edc89300090d2ebb.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/5db0ad56edc89300090d2ebb/colorLogoPNG.png",
  "description": "Kids Movie Club live on Pluto TV"
},
{
  "id": "pluto-et",
  "name": "ET",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dc0c78281eddb0009a02d5e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5dc0c78281eddb0009a02d5e/colorLogoPNG.png",
  "description": "ET live on Pluto TV"
},
{
  "id": "pluto-lively-place",
  "name": "Home.Made.Nation",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dc1cb279c91420009db261d.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5dc1cb279c91420009db261d/colorLogoPNG.png",
  "description": "Home.Made.Nation live on Pluto TV"
},
{
  "id": "pluto-cbs-news-new-york",
  "name": "CBS News New York",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dc48170e280c80009a861ab.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5dc48170e280c80009a861ab/colorLogoPNG.png",
  "description": "CBS News New York live on Pluto TV"
},
{
  "id": "pluto-cbs-news-los-angeles",
  "name": "CBS News Los Angeles",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dc481cda1d430000948a1b4.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5dc481cda1d430000948a1b4/colorLogoPNG.png",
  "description": "CBS News Los Angeles live on Pluto TV"
},
{
  "id": "pluto-cbs-news-new-york-2",
  "name": "CBS News New York",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dc9b8223687ff000936ed79.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5dc9b8223687ff000936ed79/colorLogoPNG.png",
  "description": "CBS News New York live on Pluto TV"
},
{
  "id": "pluto-cbs-news-los-angeles-2",
  "name": "CBS News Los Angeles",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5dc9b875e280c80009a8a44a.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5dc9b875e280c80009a8a44a/colorLogoPNG.png",
  "description": "CBS News Los Angeles live on Pluto TV"
},
{
  "id": "pluto-pga-tour",
  "name": "PGA TOUR",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5de94dacb394a300099fa22a.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5de94dacb394a300099fa22a/colorLogoPNG.png",
  "description": "PGA TOUR live on Pluto TV"
},
{
  "id": "pluto-nbc-news-now",
  "name": "NBC News NOW",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5df97894467dfa00091c873c.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5df97894467dfa00091c873c/colorLogoPNG.png",
  "description": "NBC News NOW live on Pluto TV"
},
{
  "id": "pluto-americas-voice",
  "name": "America's Voice News",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e1f7da4bc7d740009831259.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5e1f7da4bc7d740009831259/colorLogoPNG.png",
  "description": "America's Voice News live on Pluto TV"
},
{
  "id": "pluto-cops",
  "name": "COPS",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e1f7e089f23700009d66303.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/5e1f7e089f23700009d66303/colorLogoPNG.png",
  "description": "COPS live on Pluto TV"
},
{
  "id": "pluto-blaze-live",
  "name": "Blaze Live",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e46fba0c43b0d00096e5ac1.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5e46fba0c43b0d00096e5ac1/colorLogoPNG.png",
  "description": "Blaze Live live on Pluto TV"
},
{
  "id": "pluto-game-show-central",
  "name": "Game Show Central",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e54187aae660e00093561d6.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5e54187aae660e00093561d6/colorLogoPNG.png",
  "description": "Game Show Central live on Pluto TV"
},
{
  "id": "pluto-mlb",
  "name": "MLB",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e66968a70f34c0007d050be.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5e66968a70f34c0007d050be/colorLogoPNG.png",
  "description": "MLB live on Pluto TV"
},
{
  "id": "pluto-oan-plus",
  "name": "OAN Plus",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e7cf6c7b156d500078c5f44.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5e7cf6c7b156d500078c5f44/colorLogoPNG.png",
  "description": "OAN Plus live on Pluto TV"
},
{
  "id": "pluto-all-reality-we-tv",
  "name": "All Reality WE tv",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e82530945600e0007ca076c.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/5e82530945600e0007ca076c/colorLogoPNG.png",
  "description": "All Reality WE tv live on Pluto TV"
},
{
  "id": "pluto-the-rifleman",
  "name": "The Rifleman",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e825550e758c700077b0aef.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5e825550e758c700077b0aef/colorLogoPNG.png",
  "description": "The Rifleman live on Pluto TV"
},
{
  "id": "pluto-the-walking-dead-en-espanol",
  "name": "The Walking Dead en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e82bb378601b80007b4bd78.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5e82bb378601b80007b4bd78/colorLogoPNG.png",
  "description": "The Walking Dead en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-americas-test-kitchen",
  "name": "America's Test Kitchen",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e84f54a82f05300080e6746.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5e84f54a82f05300080e6746/colorLogoPNG.png",
  "description": "America's Test Kitchen live on Pluto TV"
},
{
  "id": "pluto-western-tv",
  "name": "Western TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e8df4bc16e34700077e77d3.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5e8df4bc16e34700077e77d3/colorLogoPNG.png",
  "description": "Western TV live on Pluto TV"
},
{
  "id": "pluto-crimenes-imperfectos",
  "name": "Cr\u00edmenes imperfectos",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e94cd036cc69d0007e8a1ba.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5e94cd036cc69d0007e8a1ba/colorLogoPNG.png",
  "description": "Cr\u00edmenes imperfectos live on Pluto TV"
},
{
  "id": "pluto-deal-or-no-deal",
  "name": "Deal or No Deal",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e9debf8c881310007d7bde1.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5e9debf8c881310007d7bde1/colorLogoPNG.png",
  "description": "Deal or No Deal live on Pluto TV"
},
{
  "id": "pluto-judge-nosey",
  "name": "Judge Nosey",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e9decb953e157000752321c.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5e9decb953e157000752321c/colorLogoPNG.png",
  "description": "Judge Nosey live on Pluto TV"
},
{
  "id": "pluto-cbs-sports-hq",
  "name": "CBS Sports HQ",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5e9f2c05172a0f0007db4786.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5e9f2c05172a0f0007db4786/colorLogoPNG_1731837352945.png",
  "description": "CBS Sports HQ live on Pluto TV"
},
{
  "id": "pluto-cbs-news-chicago",
  "name": "CBS News Chicago",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eb1aeb2fd4b8a00076c2047.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eb1aeb2fd4b8a00076c2047/colorLogoPNG.png",
  "description": "CBS News Chicago live on Pluto TV"
},
{
  "id": "pluto-cbs-news-boston",
  "name": "CBS News Boston",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eb1af2ad345340008fccd1e.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eb1af2ad345340008fccd1e/colorLogoPNG.png",
  "description": "CBS News Boston live on Pluto TV"
},
{
  "id": "pluto-cbs-news-bay-area",
  "name": "CBS News Bay Area",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eb1afb21486df0007abc57c.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eb1afb21486df0007abc57c/colorLogoPNG.png",
  "description": "CBS News Bay Area live on Pluto TV"
},
{
  "id": "pluto-cbs-news-philadelphia-ptv1",
  "name": "CBS News Philadelphia",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eb1b05ea168cc000767ba67.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eb1b05ea168cc000767ba67/colorLogoPNG.png",
  "description": "CBS News Philadelphia live on Pluto TV"
},
{
  "id": "pluto-cbs-news-minnesota",
  "name": "CBS News Minnesota",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eb1b0bf2240d8000732a09c.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eb1b0bf2240d8000732a09c/colorLogoPNG.png",
  "description": "CBS News Minnesota live on Pluto TV"
},
{
  "id": "pluto-cbs-news-colorado",
  "name": "CBS News Colorado",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eb1b12146cba40007aa7e5d.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eb1b12146cba40007aa7e5d/colorLogoPNG-1643041708234.png",
  "description": "CBS News Colorado live on Pluto TV"
},
{
  "id": "pluto-cbs-news-pittsburgh",
  "name": "CBS News Pittsburgh",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eb1b17aa5277e00083f6521.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eb1b17aa5277e00083f6521/colorLogoPNG.png",
  "description": "CBS News Pittsburgh live on Pluto TV"
},
{
  "id": "pluto-bellator-mma",
  "name": "Bellator MMA",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ebc8688f3697d00072f7cf8.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5ebc8688f3697d00072f7cf8/colorLogoPNG.png",
  "description": "Bellator MMA live on Pluto TV"
},
{
  "id": "pluto-cbs-news-texas-ptv1",
  "name": "CBS News Texas",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5eceb0d4065c240007688ec6.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5eceb0d4065c240007688ec6/colorLogoPNG.png",
  "description": "CBS News Texas live on Pluto TV"
},
{
  "id": "pluto-threes-company",
  "name": "Three's Company",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ef3977e5d773400077de284.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5ef3977e5d773400077de284/colorLogoPNG_1731835807101.png",
  "description": "Three's Company live on Pluto TV"
},
{
  "id": "pluto-csi",
  "name": "CSI",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5efbd29e4aa26700076c0d06.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5efbd29e4aa26700076c0d06/colorLogoPNG.png",
  "description": "CSI live on Pluto TV"
},
{
  "id": "pluto-star-trek-1",
  "name": "Star Trek",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5efbd39f8c4ce900075d7698.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5efbd39f8c4ce900075d7698/colorLogoPNG.png",
  "description": "Star Trek live on Pluto TV"
},
{
  "id": "pluto-classic-tv-comedy",
  "name": "Classic TV Comedy",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f15e32b297f96000768f928.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f15e32b297f96000768f928/colorLogoPNG.png",
  "description": "Classic TV Comedy live on Pluto TV"
},
{
  "id": "pluto-classic-tv-drama-ptv1",
  "name": "Classic TV Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f15e3cccf49290007053c67.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f15e3cccf49290007053c67/colorLogoPNG.png",
  "description": "Classic TV Drama live on Pluto TV"
},
{
  "id": "pluto-survivor-ptv1",
  "name": "Survivor",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f21e7b24744c60007c1f6fc.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f21e7b24744c60007c1f6fc/colorLogoPNG.png",
  "description": "Survivor live on Pluto TV"
},
{
  "id": "pluto-the-amazing-race",
  "name": "The Amazing Race",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f21e8a6e2f12b000755afdb.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f21e8a6e2f12b000755afdb/colorLogoPNG.png",
  "description": "The Amazing Race live on Pluto TV"
},
{
  "id": "pluto-smithsonian-channel-selects",
  "name": "Smithsonian Channel Selects",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f21ea08007a49000762d349.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/5f21ea08007a49000762d349/colorLogoPNG.png",
  "description": "Smithsonian Channel Selects live on Pluto TV"
},
{
  "id": "pluto-supernatural-drama",
  "name": "Supernatural Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f24662bebe0f0000767de32.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f24662bebe0f0000767de32/colorLogoPNG.png",
  "description": "Supernatural Drama live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-crime-drama",
  "name": "Pluto TV Crime Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f31fd1b4c510e00071c3103.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f31fd1b4c510e00071c3103/colorLogoPNG.png",
  "description": "Pluto TV Crime Drama live on Pluto TV"
},
{
  "id": "pluto-vevo-70s",
  "name": "Vevo '70s",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f32f26bcd8aea00071240e5.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f32f26bcd8aea00071240e5/colorLogoPNG.png",
  "description": "Vevo '70s live on Pluto TV"
},
{
  "id": "pluto-the-bob-ross-channel",
  "name": "The Bob Ross Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f36d726234ce10007784f2a.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f36d726234ce10007784f2a/colorLogoPNG.png",
  "description": "The Bob Ross Channel live on Pluto TV"
},
{
  "id": "pluto-90210",
  "name": "Beverly Hills 90210",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f4d83e0a382c00007bc02e7.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f4d83e0a382c00007bc02e7/colorLogoPNG.png",
  "description": "Beverly Hills 90210 live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-crime-movies",
  "name": "Pluto TV Crime Movies",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f4d8594eb979c0007706de7.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5f4d8594eb979c0007706de7/colorLogoPNG.png",
  "description": "Pluto TV Crime Movies live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-staff-picks",
  "name": "Pluto TV Staff Picks",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f4d863b98b41000076cd061.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5f4d863b98b41000076cd061/colorLogoPNG.png",
  "description": "Pluto TV Staff Picks live on Pluto TV"
},
{
  "id": "pluto-90s-throwback",
  "name": "90s Throwback",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f4d86f519358a00072b978e.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5f4d86f519358a00072b978e/colorLogoPNG.png",
  "description": "90s Throwback live on Pluto TV"
},
{
  "id": "pluto-70s-cinema",
  "name": "70s Cinema",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f4d878d3d19b30007d2e782.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/5f4d878d3d19b30007d2e782/colorLogoPNG.png",
  "description": "70s Cinema live on Pluto TV"
},
{
  "id": "pluto-misterios-sin-resolver-1",
  "name": "Misterios sin resolver",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f4d882d5233170007ee880e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f4d882d5233170007ee880e/colorLogoPNG.png",
  "description": "Misterios sin resolver live on Pluto TV"
},
{
  "id": "pluto-yu-gi-oh-ptv1",
  "name": "Yu-Gi-Oh!",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f4ec10ed9636f00089b8c89.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/5f4ec10ed9636f00089b8c89/colorLogoPNG.png",
  "description": "Yu-Gi-Oh! live on Pluto TV"
},
{
  "id": "pluto-cine-comedia",
  "name": "Cine comedia",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f513564e4622a0007c578c0.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f513564e4622a0007c578c0/colorLogoPNG_1757954361053.png",
  "description": "Cine comedia live on Pluto TV"
},
{
  "id": "pluto-cine-amor",
  "name": "Cine Amor",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f5136317aedfb0007016f93.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f5136317aedfb0007016f93/colorLogoPNG_1757957531383.png",
  "description": "Cine Amor live on Pluto TV"
},
{
  "id": "pluto-cmt-equal-play",
  "name": "CMT Equal Play",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f68f53eb1e5800007390bf8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f68f53eb1e5800007390bf8/colorLogoPNG.png",
  "description": "CMT Equal Play live on Pluto TV"
},
{
  "id": "pluto-narcos",
  "name": "Narcos",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f7274806621ff00072651ff.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f7274806621ff00072651ff/colorLogoPNG.png",
  "description": "Narcos live on Pluto TV"
},
{
  "id": "pluto-one-piece",
  "name": "One Piece",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f7790b3ed0c88000720b241.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/5f7790b3ed0c88000720b241/colorLogoPNG_1731837233662.png",
  "description": "One Piece live on Pluto TV"
},
{
  "id": "pluto-the-price-is-right-the-barker-era",
  "name": "The Price Is Right: The Barker Era",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f7791b8372da90007fd45e6.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f7791b8372da90007fd45e6/colorLogoPNG.png",
  "description": "The Price Is Right: The Barker Era live on Pluto TV"
},
{
  "id": "pluto-family-ties",
  "name": "Family Ties",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f77939a630f530007dde654.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/5f77939a630f530007dde654/colorLogoPNG.png",
  "description": "Family Ties live on Pluto TV"
},
{
  "id": "pluto-happy-days-ptv1",
  "name": "Happy Days",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f7794162a4559000781fc12.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f7794162a4559000781fc12/colorLogoPNG_1731835352299.png",
  "description": "Happy Days live on Pluto TV"
},
{
  "id": "pluto-the-love-boat",
  "name": "The Love Boat",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f7794a788d29000079d2f07.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f7794a788d29000079d2f07/colorLogoPNG_1731835231895.png",
  "description": "The Love Boat live on Pluto TV"
},
{
  "id": "pluto-beverly-hillbillies-ptv1",
  "name": "Beverly Hillbillies",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f7796e470510900070d4e3d.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f7796e470510900070d4e3d/colorLogoPNG_1731835751688.png",
  "description": "Beverly Hillbillies live on Pluto TV"
},
{
  "id": "pluto-mission-impossible",
  "name": "Mission Impossible",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f77977bd924d80007eee60c.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/5f77977bd924d80007eee60c/colorLogoPNG_1731835516936.png",
  "description": "Mission Impossible live on Pluto TV"
},
{
  "id": "pluto-classica",
  "name": "Classica",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f779951372da90007fd45e8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f779951372da90007fd45e8/colorLogoPNG.png",
  "description": "Classica live on Pluto TV"
},
{
  "id": "pluto-hsn",
  "name": "HSN",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f8a02476b72230007e62b7d.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5f8a02476b72230007e62b7d/colorLogoPNG_1779087603120.png",
  "description": "HSN live on Pluto TV"
},
{
  "id": "pluto-closed-caption-test-3",
  "name": "Closed Caption Test 3",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5f9b017d037a30000730c68e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/missing.png",
  "description": "Closed Caption Test 3 live on Pluto TV"
},
{
  "id": "pluto-ryan-and-friends",
  "name": "Ryan and Friends",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5fb584b7613a31000789de5a.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/5fb584b7613a31000789de5a/colorLogoPNG.png",
  "description": "Ryan and Friends live on Pluto TV"
},
{
  "id": "pluto-pokergo",
  "name": "PokerGO",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5fc54366b04b2300072e31af.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/5fc54366b04b2300072e31af/colorLogoPNG.png",
  "description": "PokerGO live on Pluto TV"
},
{
  "id": "pluto-vevo-80s",
  "name": "Vevo '80s",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5fd7b8bf927e090007685853.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5fd7b8bf927e090007685853/colorLogoPNG.png",
  "description": "Vevo '80s live on Pluto TV"
},
{
  "id": "pluto-vevo-90s",
  "name": "Vevo '90s",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5fd7bb1f86d94a000796e2c2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5fd7bb1f86d94a000796e2c2/colorLogoPNG.png",
  "description": "Vevo '90s live on Pluto TV"
},
{
  "id": "pluto-vevo-2k",
  "name": "Vevo 2K",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5fd7bca3e0a4ee0007a38e8c.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5fd7bca3e0a4ee0007a38e8c/colorLogoPNG.png",
  "description": "Vevo 2K live on Pluto TV"
},
{
  "id": "pluto-paramount-ptv1",
  "name": "Paramount+ Picks",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5ff8c708653d080007361b14.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/5ff8c708653d080007361b14/colorLogoPNG.png",
  "description": "Paramount+ Picks live on Pluto TV"
},
{
  "id": "pluto-news-12-new-york",
  "name": "News 12 New York",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-5fff49cfb5cd4f0007c2b0dc.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/5fff49cfb5cd4f0007c2b0dc/colorLogoPNG.png",
  "description": "News 12 New York live on Pluto TV"
},
{
  "id": "pluto-crime-360-by-aande",
  "name": "A&E Crime 360",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6000a5a9e767980007b497ca.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6000a5a9e767980007b497ca/colorLogoPNG_1767745470551.png",
  "description": "A&E Crime 360 live on Pluto TV"
},
{
  "id": "pluto-xtreme-outdoor-by-history",
  "name": "Xtreme Outdoor by HISTORY",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6000a6f4c3f8550008fc9b91.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6000a6f4c3f8550008fc9b91/colorLogoPNG_1767745185882.png",
  "description": "Xtreme Outdoor by HISTORY live on Pluto TV"
},
{
  "id": "pluto-tiny-house-nation",
  "name": "Tiny House Nation",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-601a0342dcf4370007566891.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/601a0342dcf4370007566891/colorLogoPNG_1775171305009.png",
  "description": "Tiny House Nation live on Pluto TV"
},
{
  "id": "pluto-hot-bench",
  "name": "Hot Bench",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6036e6e7ac69c400072afca2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6036e6e7ac69c400072afca2/colorLogoPNG_1731835667408.png",
  "description": "Hot Bench live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-game-shows",
  "name": "Pluto TV Game Shows",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6036e7c385749f00075dbd3b.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6036e7c385749f00075dbd3b/colorLogoPNG.png",
  "description": "Pluto TV Game Shows live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-competition",
  "name": "Pluto TV Competition",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-603fde9026ecbf0007752c2c.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/603fde9026ecbf0007752c2c/colorLogoPNG.png",
  "description": "Pluto TV Competition live on Pluto TV"
},
{
  "id": "pluto-csi-en-espanol",
  "name": "CSI en Espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-604928d54a4f730007ff76bc.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/604928d54a4f730007ff76bc/colorLogoPNG.png",
  "description": "CSI en Espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-viaje-a-las-estrellas",
  "name": "Star Trek en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6049295e7dcef800073c2499.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6049295e7dcef800073c2499/colorLogoPNG_1771543916293.png",
  "description": "Star Trek en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-estrella-news",
  "name": "Estrella News",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60492e6d7f3f560007ab0f62.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/60492e6d7f3f560007ab0f62/colorLogoPNG.png",
  "description": "Estrella News live on Pluto TV"
},
{
  "id": "pluto-ink-master",
  "name": "Ink Master",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60807fd5db701400078219c2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/60807fd5db701400078219c2/colorLogoPNG_1731836032181.png",
  "description": "Ink Master live on Pluto TV"
},
{
  "id": "pluto-jersey-shore",
  "name": "Jersey Shore",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-609bfa51fbecc1000733152e.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/609bfa51fbecc1000733152e/colorLogoPNG.png",
  "description": "Jersey Shore live on Pluto TV"
},
{
  "id": "pluto-bar-rescue",
  "name": "Bar Rescue",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60a3d889a5b3690008dc7fe8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/60a3d889a5b3690008dc7fe8/colorLogoPNG_1780596469446.png",
  "description": "Bar Rescue live on Pluto TV"
},
{
  "id": "pluto-cbs-news-sacramento",
  "name": "CBS News Sacramento",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60cb6df2b2ad610008cd5bea.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/60cb6df2b2ad610008cd5bea/colorLogoPNG.png",
  "description": "CBS News Sacramento live on Pluto TV"
},
{
  "id": "pluto-pbr-ridepass",
  "name": "PBR RidePass",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60d39387706fe50007fda8e8.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/60d39387706fe50007fda8e8/colorLogoPNG.png",
  "description": "PBR RidePass live on Pluto TV"
},
{
  "id": "pluto-casos-de-la-dra-polo",
  "name": "Casos de la Dra. Polo",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60d393e5579a420007ee553c.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/60d393e5579a420007ee553c/colorLogoPNG.png",
  "description": "Casos de la Dra. Polo live on Pluto TV"
},
{
  "id": "pluto-britbox-mysteries",
  "name": "BritBox Mysteries",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60f5d389985a0c0007357304.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/60f5d389985a0c0007357304/colorLogoPNG_1786980983531.png",
  "description": "BritBox Mysteries live on Pluto TV"
},
{
  "id": "pluto-the-andy-griffith-show",
  "name": "The Andy Griffith Show",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60f75178e7f8aa0007e9c259.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/60f75178e7f8aa0007e9c259/colorLogoPNG_1758310637593.png",
  "description": "The Andy Griffith Show live on Pluto TV"
},
{
  "id": "pluto-matlock",
  "name": "Matlock",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60f754f98185580007eb0754.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/60f754f98185580007eb0754/colorLogoPNG_1731836706925.png",
  "description": "Matlock live on Pluto TV"
},
{
  "id": "pluto-gunsmoke",
  "name": "Gunsmoke",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60f75771dfc72a00071fd0e0.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/60f75771dfc72a00071fd0e0/colorLogoPNG.png",
  "description": "Gunsmoke live on Pluto TV"
},
{
  "id": "pluto-cbs-news-baltimore",
  "name": "CBS News Baltimore",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60f75919718aed0007250d7a.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/60f75919718aed0007250d7a/colorLogoPNG-1643042747442.png",
  "description": "CBS News Baltimore live on Pluto TV"
},
{
  "id": "pluto-best-of-dr-phil",
  "name": "Best of Dr. Phil",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60f760bbdf090700075d7bfe.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/60f760bbdf090700075d7bfe/colorLogoPNG_1789593965816.png",
  "description": "Best of Dr. Phil live on Pluto TV"
},
{
  "id": "pluto-bet-classics",
  "name": "BET Classics",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60f85644a9493e0007a1f035.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/60f85644a9493e0007a1f035/colorLogoPNG_1759339662769.png",
  "description": "BET Classics live on Pluto TV"
},
{
  "id": "pluto-garfield-and-friends",
  "name": "Garfield and Friends",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60faf9ddfcc1f200070a5932.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/60faf9ddfcc1f200070a5932/colorLogoPNG.png",
  "description": "Garfield and Friends live on Pluto TV"
},
{
  "id": "pluto-baby-shark-tv",
  "name": "Baby Shark TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60faffc3fbbc120007fc4376.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/60faffc3fbbc120007fc4376/colorLogoPNG_1754073070812.png",
  "description": "Baby Shark TV live on Pluto TV"
},
{
  "id": "pluto-lego-kids-tv",
  "name": "LEGO Kids TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60fb01a24795a6000762fe83.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/60fb01a24795a6000762fe83/colorLogoPNG.png",
  "description": "LEGO Kids TV live on Pluto TV"
},
{
  "id": "pluto-kartoon-channel",
  "name": "Kartoon Channel!",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60fb040d4795a6000762fe8f.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/60fb040d4795a6000762fe8f/colorLogoPNG.png",
  "description": "Kartoon Channel! live on Pluto TV"
},
{
  "id": "pluto-cbs-news-miami",
  "name": "CBS News Miami",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60fb299b79498900070b29e0.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/60fb299b79498900070b29e0/colorLogoPNG.png",
  "description": "CBS News Miami live on Pluto TV"
},
{
  "id": "pluto-cine-aventura",
  "name": "Cine aventura",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-60fb2f47c133270007327375.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/60fb2f47c133270007327375/colorLogoPNG_1757954279063.png",
  "description": "Cine aventura live on Pluto TV"
},
{
  "id": "pluto-teen-mom",
  "name": "Teen Mom",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6127e12ed140e900077e7b6f.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/6127e12ed140e900077e7b6f/colorLogoPNG.png",
  "description": "Teen Mom live on Pluto TV"
},
{
  "id": "pluto-tv-land-drama-ptv1",
  "name": "TV Land Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-612fea0e970e6f00083be56b.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/612fea0e970e6f00083be56b/colorLogoPNG.png",
  "description": "TV Land Drama live on Pluto TV"
},
{
  "id": "pluto-classic-tv-crime-drama",
  "name": "Classic TV Crime Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61325c4f982acd000723287e.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/61325c4f982acd000723287e/colorLogoPNG.png",
  "description": "Classic TV Crime Drama live on Pluto TV"
},
{
  "id": "pluto-classic-tv-families",
  "name": "Classic TV: Families",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61325d18f5166c00081b84e0.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/61325d18f5166c00081b84e0/colorLogoPNG.png",
  "description": "Classic TV: Families live on Pluto TV"
},
{
  "id": "pluto-more-tv-drama",
  "name": "More TV Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-613260e4bdb71c00070d63fa.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/613260e4bdb71c00070d63fa/colorLogoPNG.png",
  "description": "More TV Drama live on Pluto TV"
},
{
  "id": "pluto-more-tv-sitcoms",
  "name": "More TV Sitcoms",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6132619f9ddaa50007e7dd86.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/6132619f9ddaa50007e7dd86/colorLogoPNG.png",
  "description": "More TV Sitcoms live on Pluto TV"
},
{
  "id": "pluto-bet-throwbacks",
  "name": "BET Throwbacks",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61326275b3c86a00078e4833.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/61326275b3c86a00078e4833/colorLogoPNG_1759340015358.png",
  "description": "BET Throwbacks live on Pluto TV"
},
{
  "id": "pluto-festive-fireplace",
  "name": "Festive Fireplace",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-614501c653ceee000772b0ca.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/614501c653ceee000772b0ca/colorLogoPNG.png",
  "description": "Festive Fireplace live on Pluto TV"
},
{
  "id": "pluto-antiques-road-trip",
  "name": "Antiques Road Trip",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-615b8ec39e878900073f419a.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/615b8ec39e878900073f419a/colorLogoPNG.png",
  "description": "Antiques Road Trip live on Pluto TV"
},
{
  "id": "pluto-48-hours",
  "name": "48 Hours",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6176f39e709f160007ec61c3.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6176f39e709f160007ec61c3/colorLogoPNG.png",
  "description": "48 Hours live on Pluto TV"
},
{
  "id": "pluto-bounce-xl",
  "name": "Bounce XL",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6176fd25e83a5f0007a464c9.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6176fd25e83a5f0007a464c9/colorLogoPNG.png",
  "description": "Bounce XL live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-reaction",
  "name": "Pluto TV Reaction",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-617b37b361e0fd0008cfd8c5.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/617b37b361e0fd0008cfd8c5/colorLogoPNG_1731837948814.png",
  "description": "Pluto TV Reaction live on Pluto TV"
},
{
  "id": "pluto-perry-mason",
  "name": "Perry Mason",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6197086891ddd4000739941a.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6197086891ddd4000739941a/colorLogoPNG_1731835750293.png",
  "description": "Perry Mason live on Pluto TV"
},
{
  "id": "pluto-blue-bloods-ptv1",
  "name": "Blue Bloods",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61b3b8c645b45d0007a9bb8d.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/61b3b8c645b45d0007a9bb8d/colorLogoPNG_1731834396573.png",
  "description": "Blue Bloods live on Pluto TV"
},
{
  "id": "pluto-tv-land-sitcoms-ptv1",
  "name": "TV Land Sitcoms",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61bd0b57872c650008ed2e38.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/61bd0b57872c650008ed2e38/colorLogoPNG.png",
  "description": "TV Land Sitcoms live on Pluto TV"
},
{
  "id": "pluto-vevo-rock",
  "name": "Vevo Rock",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61d4b38226b8a50007fe03a6.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/61d4b38226b8a50007fe03a6/colorLogoPNG_1748797615724.png",
  "description": "Vevo Rock live on Pluto TV"
},
{
  "id": "pluto-vevo-true-school-hip-hop",
  "name": "Vevo True School Hip-Hop",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61d4c2817a823d00070ba53e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/61d4c2817a823d00070ba53e/colorLogoPNG.png",
  "description": "Vevo True School Hip-Hop live on Pluto TV"
},
{
  "id": "pluto-weathernation-los-angeles",
  "name": "WeatherNation Los Angeles",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61e9af6bfbbcc6000700119b.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/61e9af6bfbbcc6000700119b/colorLogoPNG.png",
  "description": "WeatherNation Los Angeles live on Pluto TV"
},
{
  "id": "pluto-heartland",
  "name": "Heartland",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61f07513227feb00073ee6bc.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/61f07513227feb00073ee6bc/colorLogoPNG.png",
  "description": "Heartland live on Pluto TV"
},
{
  "id": "pluto-classic-movie-westerns-ptv1",
  "name": "Classic Movie Westerns",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-61f33318210549000806a530.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/61f33318210549000806a530/colorLogoPNG.png",
  "description": "Classic Movie Westerns live on Pluto TV"
},
{
  "id": "pluto-stargate",
  "name": "Stargate",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-620bfa7df72827000703ddb1.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/620bfa7df72827000703ddb1/colorLogoPNG.png",
  "description": "Stargate live on Pluto TV"
},
{
  "id": "pluto-xite-rock",
  "name": "XITE Rock x Metal",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-623a1b5188ecdc0007c9ef5a.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/623a1b5188ecdc0007c9ef5a/colorLogoPNG.png",
  "description": "XITE Rock x Metal live on Pluto TV"
},
{
  "id": "pluto-xite-classic-country",
  "name": "XITE Classic Country",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-623b92a2ccefed0007b1db48.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/623b92a2ccefed0007b1db48/colorLogoPNG.png",
  "description": "XITE Classic Country live on Pluto TV"
},
{
  "id": "pluto-xite-gospel",
  "name": "XITE Gospel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-623b93628e6ded0007337d4d.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/623b93628e6ded0007337d4d/colorLogoPNG.png",
  "description": "XITE Gospel live on Pluto TV"
},
{
  "id": "pluto-lets-make-a-deal",
  "name": "Let's Make A Deal",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6267352efcf21c0007c76642.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6267352efcf21c0007c76642/colorLogoPNG.png",
  "description": "Let's Make A Deal live on Pluto TV"
},
{
  "id": "pluto-cheaters",
  "name": "Cheaters",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-627d355aa95efd00077afcc7.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/627d355aa95efd00077afcc7/colorLogoPNG.png",
  "description": "Cheaters live on Pluto TV"
},
{
  "id": "pluto-the-judge-judy-channel",
  "name": "The Judge Judy Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6283d51144ad8f0007fa382d.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6283d51144ad8f0007fa382d/colorLogoPNG.png",
  "description": "The Judge Judy Channel live on Pluto TV"
},
{
  "id": "pluto-hallmark-movies-and-more",
  "name": "Hallmark Movies & More Holiday Favorites",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-628e685ba3811100070551a8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/628e685ba3811100070551a8/colorLogoPNG_1793556772258.png",
  "description": "Hallmark Movies & More Holiday Favorites live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-anime-ptv1",
  "name": "Pluto TV Anime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-62a2e8d8a1c8650007e95bac.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/62a2e8d8a1c8650007e95bac/colorLogoPNG_1748796689310.png",
  "description": "Pluto TV Anime live on Pluto TV"
},
{
  "id": "pluto-00s-replay",
  "name": "00s Replay",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-62ba60f059624e000781c436.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/62ba60f059624e000781c436/colorLogoPNG.png",
  "description": "00s Replay live on Pluto TV"
},
{
  "id": "pluto-csi-miami-ptv2",
  "name": "CSI: Miami",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-62f54c11b3af68000702c304.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/62f54c11b3af68000702c304/colorLogoPNG_1731837343443.png",
  "description": "CSI: Miami live on Pluto TV"
},
{
  "id": "pluto-csi-ny",
  "name": "CSI: NY",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-62f54c6439183b000769fb8f.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/62f54c6439183b000769fb8f/colorLogoPNG_1731837277521.png",
  "description": "CSI: NY live on Pluto TV"
},
{
  "id": "pluto-the-walking-dead-universe",
  "name": "The Walking Dead Universe",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-62fa8176b9884200074ef5ae.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/62fa8176b9884200074ef5ae/colorLogoPNG.png",
  "description": "The Walking Dead Universe live on Pluto TV"
},
{
  "id": "pluto-csi-miami-en-espanol",
  "name": "CSI: Miami en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-632b5950b515b000079e6b81.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/632b5950b515b000079e6b81/colorLogoPNG_1731837336190.png",
  "description": "CSI: Miami en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-csi-ny-en-espanol",
  "name": "CSI: NY en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-632b606e12a67b0007c9e371.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/632b606e12a67b0007c9e371/colorLogoPNG_1731837281479.png",
  "description": "CSI: NY en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-kiro-seattle",
  "name": "KIRO Seattle",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-632b619c8d2a6c0007ff534e.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/632b619c8d2a6c0007ff534e/colorLogoPNG.png",
  "description": "KIRO Seattle live on Pluto TV"
},
{
  "id": "pluto-sitcom-legends",
  "name": "Sitcom Legends",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-633354b63df9700007f6a1b7.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/633354b63df9700007f6a1b7/colorLogoPNG.png",
  "description": "Sitcom Legends live on Pluto TV"
},
{
  "id": "pluto-lifetime-movie-favorites",
  "name": "Lifetime Holiday Movie Favorites",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-63335b193583440007c859fb.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/63335b193583440007c859fb/colorLogoPNG_1793557453670.png",
  "description": "Lifetime Holiday Movie Favorites live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-christmas-in-july",
  "name": "Pluto TV Christmas",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-63335df531a7590007c226b9.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/63335df531a7590007c226b9/colorLogoPNG_1793115157565.png",
  "description": "Pluto TV Christmas live on Pluto TV"
},
{
  "id": "pluto-home-for-the-holidays-ptv1",
  "name": "Home for the Holidays",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6334a3355471ee0007609e21.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/6334a3355471ee0007609e21/colorLogoPNG_1763240202978.png",
  "description": "Home for the Holidays live on Pluto TV"
},
{
  "id": "pluto-vevo-holiday-ptv1",
  "name": "Vevo Holiday",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6334a3ffdc283500076acf92.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6334a3ffdc283500076acf92/colorLogoPNG_1762031770975.png",
  "description": "Vevo Holiday live on Pluto TV"
},
{
  "id": "pluto-cine-navideno-ptv1",
  "name": "Cine navide\u00f1o",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6334a4d7ae975100073994a2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6334a4d7ae975100073994a2/colorLogoPNG_1793114630853.png",
  "description": "Cine navide\u00f1o live on Pluto TV"
},
{
  "id": "pluto-pfl",
  "name": "PFL MMA",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6334a574605f140007e233c4.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/6334a574605f140007e233c4/colorLogoPNG.png",
  "description": "PFL MMA live on Pluto TV"
},
{
  "id": "pluto-star-trek-voyager",
  "name": "Star Trek: Voyager",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-634dacf51d90320007fcd5fa.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/634dacf51d90320007fcd5fa/colorLogoPNG_1758310287876.png",
  "description": "Star Trek: Voyager live on Pluto TV"
},
{
  "id": "pluto-confess-by-nosey",
  "name": "Confess by Nosey",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-634ee8f95aa9870007248333.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/634ee8f95aa9870007248333/colorLogoPNG.png",
  "description": "Confess by Nosey live on Pluto TV"
},
{
  "id": "pluto-cbs-news-detroit",
  "name": "CBS News Detroit",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-634f24cf3ce5fa0007c68f39.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/634f24cf3ce5fa0007c68f39/colorLogoPNG.png",
  "description": "CBS News Detroit live on Pluto TV"
},
{
  "id": "pluto-cbs-news-detroit-ptv1",
  "name": "CBS News Detroit",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-634f2610d5023700078f7dee.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/634f2610d5023700078f7dee/colorLogoPNG.png",
  "description": "CBS News Detroit live on Pluto TV"
},
{
  "id": "pluto-i-love-lucy-ptv1",
  "name": "I Love Lucy",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-634f3011f4fff20007431641.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/634f3011f4fff20007431641/colorLogoPNG_1731836749484.png",
  "description": "I Love Lucy live on Pluto TV"
},
{
  "id": "pluto-rawhide",
  "name": "Rawhide",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-634f307c7a068e00072c9982.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/634f307c7a068e00072c9982/colorLogoPNG_1731835685335.png",
  "description": "Rawhide live on Pluto TV"
},
{
  "id": "pluto-top-gear-ptv1",
  "name": "Top Gear",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-636adc255bcf470007d6e0e2.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/636adc255bcf470007d6e0e2/colorLogoPNG.png",
  "description": "Top Gear live on Pluto TV"
},
{
  "id": "pluto-pbs-antiques-roadshow",
  "name": "PBS Antiques Roadshow",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-636c2b3c55d2e700074105c4.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/636c2b3c55d2e700074105c4/colorLogoPNG.png",
  "description": "PBS Antiques Roadshow live on Pluto TV"
},
{
  "id": "pluto-dateline-247",
  "name": "Dateline 24/7",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-637413d8531e0c0007442d6d.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/637413d8531e0c0007442d6d/colorLogoPNG.png",
  "description": "Dateline 24/7 live on Pluto TV"
},
{
  "id": "pluto-sailor-moon",
  "name": "Sailor Moon",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-637e55347427a40007fac703.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/637e55347427a40007fac703/colorLogoPNG.png",
  "description": "Sailor Moon live on Pluto TV"
},
{
  "id": "pluto-golazo-network",
  "name": "Golazo Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-63a0e33a45264d000850ed7e.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/63a0e33a45264d000850ed7e/colorLogoPNG_1731835813404.png",
  "description": "Golazo Network live on Pluto TV"
},
{
  "id": "pluto-powernation-ptv1",
  "name": "POWERNATION",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-63b48016d9dd51000828fa37.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/63b48016d9dd51000828fa37/colorLogoPNG.png",
  "description": "POWERNATION live on Pluto TV"
},
{
  "id": "pluto-livenow-from-fox",
  "name": "LiveNOW from FOX",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-63d025db4e83e700086eaa96.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/63d025db4e83e700086eaa96/colorLogoPNG.png",
  "description": "LiveNOW from FOX live on Pluto TV"
},
{
  "id": "pluto-discovery-turbo-tv",
  "name": "Discovery Turbo TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6400f731d200410008f9b339.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/6400f731d200410008f9b339/colorLogoPNG_1767979567752.png",
  "description": "Discovery Turbo TV live on Pluto TV"
},
{
  "id": "pluto-pbs-nature",
  "name": "PBS Nature",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-640a64bd73e013000893d4e0.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/640a64bd73e013000893d4e0/colorLogoPNG.png",
  "description": "PBS Nature live on Pluto TV"
},
{
  "id": "pluto-fox-weather",
  "name": "FOX Weather",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-640a68880e884c0009979cc2.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/640a68880e884c0009979cc2/colorLogoPNG_1779087602438.png",
  "description": "FOX Weather live on Pluto TV"
},
{
  "id": "pluto-the-price-is-right",
  "name": "The Price Is Right",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-643f035d5a0cd50008361534.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/643f035d5a0cd50008361534/colorLogoPNG.png",
  "description": "The Price Is Right live on Pluto TV"
},
{
  "id": "pluto-family-feud-classics",
  "name": "Family Feud Classic",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-643f03b9d8436e0008edf021.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/643f03b9d8436e0008edf021/colorLogoPNG.png",
  "description": "Family Feud Classic live on Pluto TV"
},
{
  "id": "pluto-icarly-tv",
  "name": "iCarly TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6450209d939a5900084dba1d.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/6450209d939a5900084dba1d/colorLogoPNG.png",
  "description": "iCarly TV live on Pluto TV"
},
{
  "id": "pluto-90s-kids-tv-2",
  "name": "90s Kids TV 2",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6452c77ed3fdde00080eb3a8.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/6452c77ed3fdde00080eb3a8/colorLogoPNG.png",
  "description": "90s Kids TV 2 live on Pluto TV"
},
{
  "id": "pluto-90s-kids-tv",
  "name": "90's Kids",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6452c814939a590008567a3b.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/6452c814939a590008567a3b/colorLogoPNG_1731836283044.png",
  "description": "90's Kids live on Pluto TV"
},
{
  "id": "pluto-moviesphere-ptv1",
  "name": "MovieSphere by Lionsgate",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-645e7828e1979c00087b75b4.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/645e7828e1979c00087b75b4/colorLogoPNG.png",
  "description": "MovieSphere by Lionsgate live on Pluto TV"
},
{
  "id": "pluto-dazn-ringside",
  "name": "DAZN Ringside",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-649b6898f2ec0000081a9460.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/649b6898f2ec0000081a9460/colorLogoPNG.png",
  "description": "DAZN Ringside live on Pluto TV"
},
{
  "id": "pluto-supermarket-sweep",
  "name": "Supermarket Sweep",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-649ddbfb6f29ec000874ca9e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/649ddbfb6f29ec000874ca9e/colorLogoPNG.png",
  "description": "Supermarket Sweep live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-icons",
  "name": "Pluto TV Icons",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64b585f84ea480000838e446.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/64b585f84ea480000838e446/colorLogoPNG_1785343035531.png",
  "description": "Pluto TV Icons live on Pluto TV"
},
{
  "id": "pluto-dynasty",
  "name": "Dynasty",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64d1606b4c5ed80008e3b8b9.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/64d1606b4c5ed80008e3b8b9/colorLogoPNG_1731835571308.png",
  "description": "Dynasty live on Pluto TV"
},
{
  "id": "pluto-top-rank-classics",
  "name": "Top Rank Classics",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64d160f53c785e0008df525e.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/64d160f53c785e0008df525e/colorLogoPNG.png",
  "description": "Top Rank Classics live on Pluto TV"
},
{
  "id": "pluto-vevo-iconos-latinos",
  "name": "Vevo \u00cdconos Latinos",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64d161c93c785e0008df575e.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/64d161c93c785e0008df575e/colorLogoPNG.png",
  "description": "Vevo \u00cdconos Latinos live on Pluto TV"
},
{
  "id": "pluto-mayday-air-disaster",
  "name": "Mayday: Air Disaster",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64d2b6bf9b414d0008187d83.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/64d2b6bf9b414d0008187d83/colorLogoPNG_1780955414910.png",
  "description": "Mayday: Air Disaster live on Pluto TV"
},
{
  "id": "pluto-acapulco-shore-ptv1",
  "name": "Acapulco Shore",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64dab1f835425100080e1e7b.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/64dab1f835425100080e1e7b/colorLogoPNG_1751300628513.png",
  "description": "Acapulco Shore live on Pluto TV"
},
{
  "id": "pluto-vevo-regional-mexicano-ptv1",
  "name": "Vevo Regional Mexicano",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64dab5fe35425100080e2991.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/64dab5fe35425100080e2991/colorLogoPNG.png",
  "description": "Vevo Regional Mexicano live on Pluto TV"
},
{
  "id": "pluto-jamie-oliver-channel",
  "name": "The Jamie Oliver Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64dab9df3d48f40008868091.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/64dab9df3d48f40008868091/colorLogoPNG.png",
  "description": "The Jamie Oliver Channel live on Pluto TV"
},
{
  "id": "pluto-ghost-hunters",
  "name": "Ghost Hunters",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-64e561a4354251000823a0e0.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/64e561a4354251000823a0e0/colorLogoPNG.png",
  "description": "Ghost Hunters live on Pluto TV"
},
{
  "id": "pluto-abc-news-live",
  "name": "ABC News Live",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6508be683a0d700008c534e4.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/6508be683a0d700008c534e4/colorLogoPNG.png",
  "description": "ABC News Live live on Pluto TV"
},
{
  "id": "pluto-dating-disasters",
  "name": "Dating Disasters",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-651f239d9c7aeb0008286823.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/651f239d9c7aeb0008286823/colorLogoPNG.png",
  "description": "Dating Disasters live on Pluto TV"
},
{
  "id": "pluto-car-chase",
  "name": "Car Chase",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65244c403fd33c0008ffff31.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/65244c403fd33c0008ffff31/colorLogoPNG.png",
  "description": "Car Chase live on Pluto TV"
},
{
  "id": "pluto-more-true-crime",
  "name": "More True Crime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6532e6a9bdf3cf000887ab29.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6532e6a9bdf3cf000887ab29/colorLogoPNG.png",
  "description": "More True Crime live on Pluto TV"
},
{
  "id": "pluto-sweet-escapes",
  "name": "Warner Bros. TV Sweet Escapes",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6532e7fa045c3d0008514ca7.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/6532e7fa045c3d0008514ca7/colorLogoPNG.png",
  "description": "Warner Bros. TV Sweet Escapes live on Pluto TV"
},
{
  "id": "pluto-say-yes-to-the-dress",
  "name": "Warner Bros. TV Say Yes to the Dress",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6532e8342cf13100083b404c.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6532e8342cf13100083b404c/colorLogoPNG.png",
  "description": "Warner Bros. TV Say Yes to the Dress live on Pluto TV"
},
{
  "id": "pluto-ion",
  "name": "ION",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65453f30085df200085883d8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/65453f30085df200085883d8/colorLogoPNG.png",
  "description": "ION live on Pluto TV"
},
{
  "id": "pluto-american-crimes",
  "name": "American Crimes",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65492fc7056b9700088560b5.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/65492fc7056b9700088560b5/colorLogoPNG_1763432008789.png",
  "description": "American Crimes live on Pluto TV"
},
{
  "id": "pluto-golfpass",
  "name": "GolfPass",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65493029ab052400089e9d2f.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/65493029ab052400089e9d2f/colorLogoPNG_1766432879705.png",
  "description": "GolfPass live on Pluto TV"
},
{
  "id": "pluto-nbc-sports-now",
  "name": "NBC Sports NOW",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6549306c83595c000815a696.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/6549306c83595c000815a696/colorLogoPNG.png",
  "description": "NBC Sports NOW live on Pluto TV"
},
{
  "id": "pluto-oxygen-true-crime-archives",
  "name": "Oxygen True Crime Archives",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-654930a8346f420008d3b0b8.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/654930a8346f420008d3b0b8/colorLogoPNG.png",
  "description": "Oxygen True Crime Archives live on Pluto TV"
},
{
  "id": "pluto-bravo-vault",
  "name": "Bravo Vault",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6549310a53fc97000838fcc9.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6549310a53fc97000838fcc9/colorLogoPNG.png",
  "description": "Bravo Vault live on Pluto TV"
},
{
  "id": "pluto-real-housewives-vault",
  "name": "Real Housewives Vault",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6549316d2c1d330008631496.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6549316d2c1d330008631496/colorLogoPNG.png",
  "description": "Real Housewives Vault live on Pluto TV"
},
{
  "id": "pluto-million-dollar-listing-vault",
  "name": "Million Dollar Listing Vault",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6549322e53fc97000838febc.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6549322e53fc97000838febc/colorLogoPNG.png",
  "description": "Million Dollar Listing Vault live on Pluto TV"
},
{
  "id": "pluto-bad-girls-club",
  "name": "Bad Girls Club",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-654932fa4d6d8f00084c4723.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/654932fa4d6d8f00084c4723/colorLogoPNG.png",
  "description": "Bad Girls Club live on Pluto TV"
},
{
  "id": "pluto-murder-she-wrote",
  "name": "Murder, She Wrote",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6549337183595c000815ad05.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6549337183595c000815ad05/colorLogoPNG.png",
  "description": "Murder, She Wrote live on Pluto TV"
},
{
  "id": "pluto-little-house-on-the-prairie",
  "name": "Little House on the Prairie",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-654933ac986ad20008a1f406.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/654933ac986ad20008a1f406/colorLogoPNG.png",
  "description": "Little House on the Prairie live on Pluto TV"
},
{
  "id": "pluto-universal-action",
  "name": "Universal Action",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-654933e253fc970008390114.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/654933e253fc970008390114/colorLogoPNG.png",
  "description": "Universal Action live on Pluto TV"
},
{
  "id": "pluto-universal-crime",
  "name": "Universal Crime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6549341853fc9700083901ac.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6549341853fc9700083901ac/colorLogoPNG.png",
  "description": "Universal Crime live on Pluto TV"
},
{
  "id": "pluto-crunchyroll",
  "name": "Crunchyroll",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65652f7fc0fc88000883537a.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/65652f7fc0fc88000883537a/colorLogoPNG.png",
  "description": "Crunchyroll live on Pluto TV"
},
{
  "id": "pluto-bbc-earth",
  "name": "BBC Earth",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-656535fc2c46f30008870fae.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/656535fc2c46f30008870fae/colorLogoPNG.png",
  "description": "BBC Earth live on Pluto TV"
},
{
  "id": "pluto-criminal-minds",
  "name": "Criminal Minds",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65653817c917a5000844bc30.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/65653817c917a5000844bc30/colorLogoPNG.png",
  "description": "Criminal Minds live on Pluto TV"
},
{
  "id": "pluto-unxplained-zone",
  "name": "UnXplained Zone",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-656538f8954b020008d389db.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/656538f8954b020008d389db/colorLogoPNG_1767736227039.png",
  "description": "UnXplained Zone live on Pluto TV"
},
{
  "id": "pluto-pickers-and-pawn",
  "name": "American Pickers Plus by History",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6565413e4261ca0008215320.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6565413e4261ca0008215320/colorLogoPNG_1792511758070.png",
  "description": "American Pickers Plus by History live on Pluto TV"
},
{
  "id": "pluto-warner-bros-tv-ultimate-builds",
  "name": "Ultimate Builds",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-656542ae4261ca00082154a8.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/656542ae4261ca00082154a8/colorLogoPNG.png",
  "description": "Ultimate Builds live on Pluto TV"
},
{
  "id": "pluto-warner-bros-tv-rustic-retreats",
  "name": "Rustic Retreats",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6565430c9d5ac4000822f508.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/6565430c9d5ac4000822f508/colorLogoPNG.png",
  "description": "Rustic Retreats live on Pluto TV"
},
{
  "id": "pluto-feel-good-drama",
  "name": "Feel Good Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65775af3b3801200084a3aa4.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/65775af3b3801200084a3aa4/colorLogoPNG.png",
  "description": "Feel Good Drama live on Pluto TV"
},
{
  "id": "pluto-modern-marvels-presented-by-history",
  "name": "Modern Marvels by HISTORY",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65775d29dfed030008cb3db2.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/65775d29dfed030008cb3db2/colorLogoPNG.png",
  "description": "Modern Marvels by HISTORY live on Pluto TV"
},
{
  "id": "pluto-nbc-los-angeles-news",
  "name": "NBC Los Angeles News",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65790cda6e4f6a0008768764.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/65790cda6e4f6a0008768764/colorLogoPNG.png",
  "description": "NBC Los Angeles News live on Pluto TV"
},
{
  "id": "pluto-telemundo-noticias-california",
  "name": "Telemundo Noticias California",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65790feacbd0d60008fac87a.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/65790feacbd0d60008fac87a/colorLogoPNG.png",
  "description": "Telemundo Noticias California live on Pluto TV"
},
{
  "id": "pluto-the-lone-ranger",
  "name": "The Lone Ranger",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65a6dafb7bdc8d0008473c85.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/65a6dafb7bdc8d0008473c85/colorLogoPNG.png",
  "description": "The Lone Ranger live on Pluto TV"
},
{
  "id": "pluto-universal-monsters",
  "name": "Universal Monsters",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65a9b20f0c7ff50008d3a3b6.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/65a9b20f0c7ff50008d3a3b6/colorLogoPNG.png",
  "description": "Universal Monsters live on Pluto TV"
},
{
  "id": "pluto-monster-jam",
  "name": "Monster Jam",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65c69b683ba51e00084534a3.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/65c69b683ba51e00084534a3/colorLogoPNG.png",
  "description": "Monster Jam live on Pluto TV"
},
{
  "id": "pluto-star-trek-deep-space-nine",
  "name": "Star Trek: Deep Space Nine",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65c69bbfd77d450008c7ffee.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/65c69bbfd77d450008c7ffee/colorLogoPNG_1758310416057.png",
  "description": "Star Trek: Deep Space Nine live on Pluto TV"
},
{
  "id": "pluto-tough-jobs",
  "name": "Tough Jobs",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65c69bf23ef47d0008583967.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/65c69bf23ef47d0008583967/colorLogoPNG.png",
  "description": "Tough Jobs live on Pluto TV"
},
{
  "id": "pluto-bbc-news",
  "name": "BBC News",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65d92a8c8b24c80008e285c0.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/65d92a8c8b24c80008e285c0/colorLogoPNG.png",
  "description": "BBC News live on Pluto TV"
},
{
  "id": "pluto-mister-rogers-neighborhood",
  "name": "Mister Rogers' Neighborhood",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65e23f340d4561000821540d.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/65e23f340d4561000821540d/colorLogoPNG.png",
  "description": "Mister Rogers' Neighborhood live on Pluto TV"
},
{
  "id": "pluto-uefa-champions-league",
  "name": "UEFA Champions League",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-65ea8b928145cb0008509426.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/65ea8b928145cb0008509426/colorLogoPNG.png",
  "description": "UEFA Champions League live on Pluto TV"
},
{
  "id": "pluto-bet-visionaries",
  "name": "BET Visionaries",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-663946c1b18d700008d9c168.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/663946c1b18d700008d9c168/colorLogoPNG_1759338795452.png",
  "description": "BET Visionaries live on Pluto TV"
},
{
  "id": "pluto-wild-wild-west",
  "name": "The Wild Wild West",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-664e640a0120f40008be4582.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/664e640a0120f40008be4582/colorLogoPNG.png",
  "description": "The Wild Wild West live on Pluto TV"
},
{
  "id": "pluto-dog-whisperer-with-cesar-millan",
  "name": "Dog Whisperer with Cesar Millan",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-664fd48894d5580008e45e7c.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/664fd48894d5580008e45e7c/colorLogoPNG.png",
  "description": "Dog Whisperer with Cesar Millan live on Pluto TV"
},
{
  "id": "pluto-big-brother",
  "name": "Big Brother",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6661f11a41af6400080e90d8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6661f11a41af6400080e90d8/colorLogoPNG.png",
  "description": "Big Brother live on Pluto TV"
},
{
  "id": "pluto-bet-x-tyler-perry-comedy",
  "name": "BET x Tyler Perry Comedy",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-666b265722acab000885c6aa.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/666b265722acab000885c6aa/colorLogoPNG.png",
  "description": "BET x Tyler Perry Comedy live on Pluto TV"
},
{
  "id": "pluto-bet-x-tyler-perry-drama",
  "name": "BET x Tyler Perry Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-666b38a5efa2a10008b15b3a.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/666b38a5efa2a10008b15b3a/colorLogoPNG_1785341580263.png",
  "description": "BET x Tyler Perry Drama live on Pluto TV"
},
{
  "id": "pluto-ebony-tv-drama",
  "name": "Ebony TV Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6675c713fc3a46000863dde7.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6675c713fc3a46000863dde7/colorLogoPNG.png",
  "description": "Ebony TV Drama live on Pluto TV"
},
{
  "id": "pluto-nash-bridges",
  "name": "Nash Bridges",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6675c742ca74680008566b88.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6675c742ca74680008566b88/colorLogoPNG.png",
  "description": "Nash Bridges live on Pluto TV"
},
{
  "id": "pluto-pokemon",
  "name": "Pok\u00e9mon",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6675c7868768aa0008d7f1c7.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/6675c7868768aa0008d7f1c7/colorLogoPNG.png",
  "description": "Pok\u00e9mon live on Pluto TV"
},
{
  "id": "pluto-star-trek-the-motion-pictures",
  "name": "Star Trek: The Motion Pictures",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6675c88da1d7ad00084762cb.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/6675c88da1d7ad00084762cb/colorLogoPNG.png",
  "description": "Star Trek: The Motion Pictures live on Pluto TV"
},
{
  "id": "pluto-fox-local-los-angeles",
  "name": "FOX LOCAL Los Angeles",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-667f2c7b22acab0008b7072b.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/667f2c7b22acab0008b7072b/colorLogoPNG_1766525230432.png",
  "description": "FOX LOCAL Los Angeles live on Pluto TV"
},
{
  "id": "pluto-go-go-gadget",
  "name": "Go Go Gadget!",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-667f3852efa2a10008e1e514.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/667f3852efa2a10008e1e514/colorLogoPNG.png",
  "description": "Go Go Gadget! live on Pluto TV"
},
{
  "id": "pluto-strawberry-shortcake-and-friends",
  "name": "Strawberry Shortcake and Friends",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-667f393836a2f90008fd17c0.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/667f393836a2f90008fd17c0/colorLogoPNG_1753982261322.png",
  "description": "Strawberry Shortcake and Friends live on Pluto TV"
},
{
  "id": "pluto-la-familia-del-barrio-ptv1",
  "name": "La Familia del Barrio",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-668c566d08d5490008075948.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/668c566d08d5490008075948/colorLogoPNG.png",
  "description": "La Familia del Barrio live on Pluto TV"
},
{
  "id": "pluto-cbs-en-espanol",
  "name": "CBS en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-668c5cb4f01dbe0008dd4082.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/668c5cb4f01dbe0008dd4082/colorLogoPNG.png",
  "description": "CBS en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-salem-news-channel",
  "name": "Salem News Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66a7f0a78561260008c177f2.m3u8",
  "category": "News",
  "logo": "https://images.pluto.tv/channels/66a7f0a78561260008c177f2/colorLogoPNG.png",
  "description": "Salem News Channel live on Pluto TV"
},
{
  "id": "pluto-vh1-queens-of-reality",
  "name": "VH1 Queens of Reality",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66abefe5d2d50d00082c7d12.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/66abefe5d2d50d00082c7d12/colorLogoPNG.png",
  "description": "VH1 Queens of Reality live on Pluto TV"
},
{
  "id": "pluto-60-minutes",
  "name": "60 Minutes",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66b646f9cd0d3100086af83c.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/66b646f9cd0d3100086af83c/colorLogoPNG.png",
  "description": "60 Minutes live on Pluto TV"
},
{
  "id": "pluto-cheers-frasier",
  "name": "Frasier",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66ba495ffe11e5000881f049.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/66ba495ffe11e5000881f049/colorLogoPNG_1782142982491.png",
  "description": "Frasier live on Pluto TV"
},
{
  "id": "pluto-sala-de-emergencias",
  "name": "Sala de Emergencias: Historias In\u00e9ditas",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66ba53cda4ee2700083fac09.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/66ba53cda4ee2700083fac09/colorLogoPNG.png",
  "description": "Sala de Emergencias: Historias In\u00e9ditas live on Pluto TV"
},
{
  "id": "pluto-andromeda-ptv2",
  "name": "Andromeda",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66c638726838ee00085ac20d.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/66c638726838ee00085ac20d/colorLogoPNG_1772843691075.png",
  "description": "Andromeda live on Pluto TV"
},
{
  "id": "pluto-love-nature",
  "name": "Love Nature",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66df8a29b25d2b0008fc5fe0.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/66df8a29b25d2b0008fc5fe0/colorLogoPNG.png",
  "description": "Love Nature live on Pluto TV"
},
{
  "id": "pluto-homeful-ptv1",
  "name": "Homeful",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66df8aa7abec540008ca8cb6.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/66df8aa7abec540008ca8cb6/colorLogoPNG.png",
  "description": "Homeful live on Pluto TV"
},
{
  "id": "pluto-places-spaces",
  "name": "Places & Spaces",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66e0b265dd2d690008c5496b.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/66e0b265dd2d690008c5496b/colorLogoPNG_1793200524996.png",
  "description": "Places & Spaces live on Pluto TV"
},
{
  "id": "pluto-cnn-originals",
  "name": "CNN Originals",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66e0b4536ad04d0008fff4b2.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/66e0b4536ad04d0008fff4b2/colorLogoPNG_1755018282136.png",
  "description": "CNN Originals live on Pluto TV"
},
{
  "id": "pluto-mythbusters",
  "name": "MythBusters",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66e0b4866ad04d0008fff4d8.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/66e0b4866ad04d0008fff4d8/colorLogoPNG.png",
  "description": "MythBusters live on Pluto TV"
},
{
  "id": "pluto-hit-sitcoms",
  "name": "Hit Sitcoms",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66e0b4a3f0f17500085cc268.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/66e0b4a3f0f17500085cc268/colorLogoPNG.png",
  "description": "Hit Sitcoms live on Pluto TV"
},
{
  "id": "pluto-el-reino-infantil-ptv1",
  "name": "El Reino Infantil",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66fedd65d7de140008dccd66.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/66fedd65d7de140008dccd66/colorLogoPNG.png",
  "description": "El Reino Infantil live on Pluto TV"
},
{
  "id": "pluto-no-reservations",
  "name": "No Reservations",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66ff0cf663292d0008320cf8.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/66ff0cf663292d0008320cf8/colorLogoPNG.png",
  "description": "No Reservations live on Pluto TV"
},
{
  "id": "pluto-holidayscapes",
  "name": "Stingray Holidayscapes",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-66ff1d5a565d3a000892bdcd.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/66ff1d5a565d3a000892bdcd/colorLogoPNG_1793557277076.png",
  "description": "Stingray Holidayscapes live on Pluto TV"
},
{
  "id": "pluto-family-feud",
  "name": "Family Feud",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-672e4d915534bb0008c50168.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/672e4d915534bb0008c50168/colorLogoPNG_1732662454856.png",
  "description": "Family Feud live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-trending-now",
  "name": "Pluto TV Trending Now",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-673247127d5da5000817b4d6.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/673247127d5da5000817b4d6/colorLogoPNG_1732662634386.png",
  "description": "Pluto TV Trending Now live on Pluto TV"
},
{
  "id": "pluto-cnn-noticias",
  "name": "CNN Noticias",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-673248f9030a2c0008033af8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/673248f9030a2c0008033af8/colorLogoPNG_1777908720377.png",
  "description": "CNN Noticias live on Pluto TV"
},
{
  "id": "pluto-construcciones-asombrosas",
  "name": "Construcciones Asombrosas",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-673249433a61d400087a51ed.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/673249433a61d400087a51ed/colorLogoPNG_1732662528285.png",
  "description": "Construcciones Asombrosas live on Pluto TV"
},
{
  "id": "pluto-crimen",
  "name": "Crimen",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6732499ce40c4a0008bb9894.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6732499ce40c4a0008bb9894/colorLogoPNG.png",
  "description": "Crimen live on Pluto TV"
},
{
  "id": "pluto-vidas-extremas",
  "name": "Vidas Extremas",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-673249afc7626f0008c7205d.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/673249afc7626f0008c7205d/colorLogoPNG.png",
  "description": "Vidas Extremas live on Pluto TV"
},
{
  "id": "pluto-the-twilight-zone-ptv",
  "name": "The Twilight Zone",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67352ed93a61d4000881f9fa.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/67352ed93a61d4000881f9fa/colorLogoPNG_1732662672508.png",
  "description": "The Twilight Zone live on Pluto TV"
},
{
  "id": "pluto-dinos-247",
  "name": "Dinos 24/7",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-673bf05ddaad7f0008ac7a5c.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/673bf05ddaad7f0008ac7a5c/colorLogoPNG.png",
  "description": "Dinos 24/7 live on Pluto TV"
},
{
  "id": "pluto-revry-ptv1",
  "name": "Revry",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-674f735a2fb8a100087bf253.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/674f735a2fb8a100087bf253/colorLogoPNG_1748892659343.png",
  "description": "Revry live on Pluto TV"
},
{
  "id": "pluto-ufc",
  "name": "UFC",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-677d9adfa9a51b0008497fa0.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/677d9adfa9a51b0008497fa0/colorLogoPNG.png",
  "description": "UFC live on Pluto TV"
},
{
  "id": "pluto-qvc2",
  "name": "QVC2",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67817323dd7846fe546940dd.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/67817323dd7846fe546940dd/colorLogoPNG.png",
  "description": "QVC2 live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-rocky-creed",
  "name": "Pluto TV ROCKY + Creed",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6785b98d688edb0008cb99be.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/6785b98d688edb0008cb99be/colorLogoPNG.png",
  "description": "Pluto TV ROCKY + Creed live on Pluto TV"
},
{
  "id": "pluto-sketchy-af",
  "name": "Sketchy AF",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67882c1c7b11714b795c2008.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/67882c1c7b11714b795c2008/colorLogoPNG.png",
  "description": "Sketchy AF live on Pluto TV"
},
{
  "id": "pluto-the-nba-channel",
  "name": "The NBA Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6792c30abc03978b9b8bb832.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/6792c30abc03978b9b8bb832/colorLogoPNG_1747950897785.png",
  "description": "The NBA Channel live on Pluto TV"
},
{
  "id": "pluto-allblk-gems",
  "name": "ALLBLK Gems",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6793ea255225b515b4ba91a7.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6793ea255225b515b4ba91a7/colorLogoPNG.png",
  "description": "ALLBLK Gems live on Pluto TV"
},
{
  "id": "pluto-anime-x-hidive",
  "name": "ANIME x HIDIVE",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6793eaa4bc03978b9bc63db1.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/6793eaa4bc03978b9bc63db1/colorLogoPNG_1746815871603.png",
  "description": "ANIME x HIDIVE live on Pluto TV"
},
{
  "id": "pluto-degrassi-vidaa-test",
  "name": "Degrassi VIDAA TEST",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67c0a90621445314490642c8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/67c0a90621445314490642c8/colorLogoPNG.png",
  "description": "Degrassi VIDAA TEST live on Pluto TV"
},
{
  "id": "pluto-heartland-vidaa-test",
  "name": "Heartland VIDAA TEST",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67c0ac57214453144906eb48.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/67c0ac57214453144906eb48/colorLogoPNG.png",
  "description": "Heartland VIDAA TEST live on Pluto TV"
},
{
  "id": "pluto-the-martha-stewart-channel",
  "name": "The Martha Stewart Channel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67c62ac2095aea2ec805eb34.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/67c62ac2095aea2ec805eb34/colorLogoPNG.png",
  "description": "The Martha Stewart Channel live on Pluto TV"
},
{
  "id": "pluto-inuyasha-ptv2",
  "name": "Inuyasha",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67c63b90a20c0399a381b816.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/67c63b90a20c0399a381b816/colorLogoPNG_1745441127472.png",
  "description": "Inuyasha live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-anime-movies",
  "name": "Pluto TV Anime Movies",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-67ed8f7e443f0671bc2b2368.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/67ed8f7e443f0671bc2b2368/colorLogoPNG_1747069531459.png",
  "description": "Pluto TV Anime Movies live on Pluto TV"
},
{
  "id": "pluto-tennischannel-2",
  "name": "TennisChannel 2",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-681109b688b9d85d0938c6ba.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/681109b688b9d85d0938c6ba/colorLogoPNG_1747434868944.png",
  "description": "TennisChannel 2 live on Pluto TV"
},
{
  "id": "pluto-awsn",
  "name": "AWSN",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-682e43b21295f98347710917.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/682e43b21295f98347710917/colorLogoPNG_1748886692805.png",
  "description": "AWSN live on Pluto TV"
},
{
  "id": "pluto-swerve-womens-sports",
  "name": "Swerve Women\u2019s Sports",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-683df56f5195c2a60a3f5559.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/683df56f5195c2a60a3f5559/colorLogoPNG_1775667541424.png",
  "description": "Swerve Women\u2019s Sports live on Pluto TV"
},
{
  "id": "pluto-p-vll",
  "name": "P+ VLL",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-683f67fde5f82715941c047b.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/missing.png",
  "description": "P+ VLL live on Pluto TV"
},
{
  "id": "pluto-50-cent-action",
  "name": "50 Cent Action",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68487fb3f212bedacf5a53e3.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/68487fb3f212bedacf5a53e3/colorLogoPNG_1749846553889.png",
  "description": "50 Cent Action live on Pluto TV"
},
{
  "id": "pluto-tastemade-smokehouse",
  "name": "Tastemade Smokehouse",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68509fe882d704acfc5bacd1.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/68509fe882d704acfc5bacd1/colorLogoPNG_1750914005853.png",
  "description": "Tastemade Smokehouse live on Pluto TV"
},
{
  "id": "pluto-wicked-tuna",
  "name": "Wicked Tuna",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-686c2677ed17cf4c900a496d.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/686c2677ed17cf4c900a496d/colorLogoPNG_1755124512679.png",
  "description": "Wicked Tuna live on Pluto TV"
},
{
  "id": "pluto-black-family-sitcoms",
  "name": "Black Family Sitcoms",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-686d61503484d6073283059d.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/686d61503484d6073283059d/colorLogoPNG_1752619670829.png",
  "description": "Black Family Sitcoms live on Pluto TV"
},
{
  "id": "pluto-womens-sports-network-ptv1",
  "name": "Women's Sports Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-686d8dd294a028da3ac59566.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/686d8dd294a028da3ac59566/colorLogoPNG_1753992941899.png",
  "description": "Women's Sports Network live on Pluto TV"
},
{
  "id": "pluto-americas-next-top-model-ptv2",
  "name": "America's Next Top Model",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68757c45759366af05b3b199.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/68757c45759366af05b3b199/colorLogoPNG-1756852664017.png",
  "description": "America's Next Top Model live on Pluto TV"
},
{
  "id": "pluto-project-runway",
  "name": "Project Runway",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68757c60552299d2b080eab6.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/68757c60552299d2b080eab6/colorLogoPNG_1753221108158.png",
  "description": "Project Runway live on Pluto TV"
},
{
  "id": "pluto-tony-robbins-network",
  "name": "Tony Robbins Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68757effdf333e336be1e49f.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/68757effdf333e336be1e49f/colorLogoPNG_1754963877109.png",
  "description": "Tony Robbins Network live on Pluto TV"
},
{
  "id": "pluto-law-and-order",
  "name": "Law & Order",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68758038552299d2b08162e3.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/68758038552299d2b08162e3/colorLogoPNG_1754039420438.png",
  "description": "Law & Order live on Pluto TV"
},
{
  "id": "pluto-mas-adrenalina",
  "name": "M\u00e1s adrenalina",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-687fea9a4fa995eff284a1c8.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/687fea9a4fa995eff284a1c8/colorLogoPNG_1755151031497.png",
  "description": "M\u00e1s adrenalina live on Pluto TV"
},
{
  "id": "pluto-beyond-the-gates",
  "name": "Beyond the Gates",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-687ff00ff6bc08130f16ab81.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/687ff00ff6bc08130f16ab81/colorLogoPNG_1755074273752.png",
  "description": "Beyond the Gates live on Pluto TV"
},
{
  "id": "pluto-live-pd-presents",
  "name": "Live PD Presents",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6887a4e01067b66fa16966ec.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6887a4e01067b66fa16966ec/colorLogoPNG_1757525803914.png",
  "description": "Live PD Presents live on Pluto TV"
},
{
  "id": "pluto-matched-married-meet-by-lifetime",
  "name": "Matched Married Meet by Lifetime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6887a86be3703b7d42b3eca3.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6887a86be3703b7d42b3eca3/colorLogoPNG_1757524386570.png",
  "description": "Matched Married Meet by Lifetime live on Pluto TV"
},
{
  "id": "pluto-ancient-aliens",
  "name": "Ancient Aliens",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6887a8fd8e92b5e0a7244e88.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6887a8fd8e92b5e0a7244e88/colorLogoPNG_1753992701393.png",
  "description": "Ancient Aliens live on Pluto TV"
},
{
  "id": "pluto-the-first-48-by-aande",
  "name": "The First 48 by A&E",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6887aaade3703b7d42b64be8.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6887aaade3703b7d42b64be8/colorLogoPNG_1754999153420.png",
  "description": "The First 48 by A&E live on Pluto TV"
},
{
  "id": "pluto-storage-wars",
  "name": "Storage Wars by A&E",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6887aaf4e3703b7d42b71a1e.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/6887aaf4e3703b7d42b71a1e/colorLogoPNG_1784129527094.png",
  "description": "Storage Wars by A&E live on Pluto TV"
},
{
  "id": "pluto-hogans-heroes",
  "name": "Hogan's Heroes",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68939e206727ec919bb39061.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/68939e206727ec919bb39061/colorLogoPNG_1757523507747.png",
  "description": "Hogan's Heroes live on Pluto TV"
},
{
  "id": "pluto-beach-day",
  "name": "Beach Day",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68bb162bb3900870ec364cbe.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/68bb162bb3900870ec364cbe/colorLogoPNG_1757977922278.png",
  "description": "Beach Day live on Pluto TV"
},
{
  "id": "pluto-living-with-evil",
  "name": "Living With Evil",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68bb164fb3900870ec368759.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/68bb164fb3900870ec368759/colorLogoPNG_1785342013286.png",
  "description": "Living With Evil live on Pluto TV"
},
{
  "id": "pluto-best-of-bobby-flay",
  "name": "Best of Bobby Flay by Food Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68bb167e00a2f063fdf7ee8f.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/68bb167e00a2f063fdf7ee8f/colorLogoPNG_1757722144825.png",
  "description": "Best of Bobby Flay by Food Network live on Pluto TV"
},
{
  "id": "pluto-home-cooking",
  "name": "Home Cooking by Food Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68bb16916523408b14bac7f8.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/68bb16916523408b14bac7f8/colorLogoPNG_1757969887631.png",
  "description": "Home Cooking by Food Network live on Pluto TV"
},
{
  "id": "pluto-chef-vs-chef",
  "name": "Chef vs Chef by Food Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68bb16a500a2f063fdf89f8c.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/68bb16a500a2f063fdf89f8c/colorLogoPNG_1757718859405.png",
  "description": "Chef vs Chef by Food Network live on Pluto TV"
},
{
  "id": "pluto-delicious-eats",
  "name": "Delicious Eats by Food Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68bb16ba3efb41cd971f3ce6.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/68bb16ba3efb41cd971f3ce6/colorLogoPNG_1757719016994.png",
  "description": "Delicious Eats by Food Network live on Pluto TV"
},
{
  "id": "pluto-chip-and-jo-feels-like-home-by-magnolia-network",
  "name": "Chip & Jo: Feels Like Home by Magnolia Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68bb16e7f89c82a68bcc4397.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/68bb16e7f89c82a68bcc4397/colorLogoPNG_1758697632132.png",
  "description": "Chip & Jo: Feels Like Home by Magnolia Network live on Pluto TV"
},
{
  "id": "pluto-bet-comedy-movies",
  "name": "BET Comedy Movies",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68c32d88f56983aba40052bd.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/68c32d88f56983aba40052bd/colorLogoPNG_1759246622596.png",
  "description": "BET Comedy Movies live on Pluto TV"
},
{
  "id": "pluto-the-brady-bunch",
  "name": "The Brady Bunch",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68e40b54cba140ddfe5fb3b5.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/68e40b54cba140ddfe5fb3b5/colorLogoPNG_1764176830263.png",
  "description": "The Brady Bunch live on Pluto TV"
},
{
  "id": "pluto-the-hills-laguna-beach",
  "name": "The Hills / Laguna Beach",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68e40bc9a1646a6c555a7e85.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/68e40bc9a1646a6c555a7e85/colorLogoPNG_1767996779003.png",
  "description": "The Hills / Laguna Beach live on Pluto TV"
},
{
  "id": "pluto-bonanza",
  "name": "Bonanza",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68e9913c4a666b9054849832.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/68e9913c4a666b9054849832/colorLogoPNG_1762379692322.png",
  "description": "Bonanza live on Pluto TV"
},
{
  "id": "pluto-shop-lc",
  "name": "Shop LC",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68ee9a999938143525bfc385.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/68ee9a999938143525bfc385/colorLogoPNG_1760999630595.png",
  "description": "Shop LC live on Pluto TV"
},
{
  "id": "pluto-bet-holiday-movies",
  "name": "BET Holiday Movies",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68f690e7a25ba0aab32bed92.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/68f690e7a25ba0aab32bed92/colorLogoPNG_1760989733981.png",
  "description": "BET Holiday Movies live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-franchise-favorites",
  "name": "Pluto TV Franchise Favorites",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-68fbf8101d26140175db8b58.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/68fbf8101d26140175db8b58/colorLogoPNG_1762383685562.png",
  "description": "Pluto TV Franchise Favorites live on Pluto TV"
},
{
  "id": "pluto-the-x-files",
  "name": "The X-Files",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6913e381b6bf26bb6e798c13.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6913e381b6bf26bb6e798c13/colorLogoPNG_1767310653556.png",
  "description": "The X-Files live on Pluto TV"
},
{
  "id": "pluto-americas-funniest-home-videos-holiday-edition",
  "name": "America's Funniest Home Videos",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-691cf0410a78a9ce61ad2121.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/691cf0410a78a9ce61ad2121/colorLogoPNG_1767642885256.png",
  "description": "America's Funniest Home Videos live on Pluto TV"
},
{
  "id": "pluto-el-rey-rebel",
  "name": "El Rey Rebel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-691d1200c2185a44642f5e7c.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/691d1200c2185a44642f5e7c/colorLogoPNG_1764783865457.png",
  "description": "El Rey Rebel live on Pluto TV"
},
{
  "id": "pluto-tiktok-radio",
  "name": "TikTok Radio",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69445a9a78c0c45b6c9aa8b9.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/69445a9a78c0c45b6c9aa8b9/colorLogoPNG_1771261855448.png",
  "description": "TikTok Radio live on Pluto TV"
},
{
  "id": "pluto-star-trek-enterprise",
  "name": "Star Trek: Enterprise",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-695c32671ca20bb8ca7fd8f7.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/695c32671ca20bb8ca7fd8f7/colorLogoPNG_1768440939423.png",
  "description": "Star Trek: Enterprise live on Pluto TV"
},
{
  "id": "pluto-star-trek-the-next-generation",
  "name": "Star Trek: The Next Generation",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-695c32e61ca20bb8ca802eb9.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/695c32e61ca20bb8ca802eb9/colorLogoPNG_1768440087394.png",
  "description": "Star Trek: The Next Generation live on Pluto TV"
},
{
  "id": "pluto-djazz",
  "name": "Stingray DJAZZ",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-696689d13b9ce349c9be3a18.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/696689d13b9ce349c9be3a18/colorLogoPNG_1771027556714.png",
  "description": "Stingray DJAZZ live on Pluto TV"
},
{
  "id": "pluto-boruto-naruto-next-generations-ptv2",
  "name": "Boruto: Naruto Next Generations",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-696997049889f8db34c936c2.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/696997049889f8db34c936c2/colorLogoPNG_1771029425876.png",
  "description": "Boruto: Naruto Next Generations live on Pluto TV"
},
{
  "id": "pluto-qello-concerts",
  "name": "Qello Concerts",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-696998915a0ae9e1b563f0c6.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/696998915a0ae9e1b563f0c6/colorLogoPNG_1770231500279.png",
  "description": "Qello Concerts live on Pluto TV"
},
{
  "id": "pluto-zenlife",
  "name": "ZenLIFE by Stingray",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-696998dfa2b623e8b20125a3.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/696998dfa2b623e8b20125a3/colorLogoPNG_1770231337178.png",
  "description": "ZenLIFE by Stingray live on Pluto TV"
},
{
  "id": "pluto-growthday",
  "name": "GrowthDay Network",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69699ae5d301d54fb3dc1499.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/69699ae5d301d54fb3dc1499/colorLogoPNG_1772167334184.png",
  "description": "GrowthDay Network live on Pluto TV"
},
{
  "id": "pluto-world-of-love-island",
  "name": "World of Love Island",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69699b6d23ea437206f4a036.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/69699b6d23ea437206f4a036/colorLogoPNG_1770050839989.png",
  "description": "World of Love Island live on Pluto TV"
},
{
  "id": "pluto-property-brothers",
  "name": "Property Brothers",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-698384cb7230043f21f4a3f4.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/698384cb7230043f21f4a3f4/colorLogoPNG_1771374915234.png",
  "description": "Property Brothers live on Pluto TV"
},
{
  "id": "pluto-ridiculousness",
  "name": "Ridiculousness",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6996296087742204bff43147.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/6996296087742204bff43147/colorLogoPNG_1772645176417.png",
  "description": "Ridiculousness live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-hometown-drama",
  "name": "Pluto TV Hometown Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69d6c7befde57cd5ba0160c3.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/69d6c7befde57cd5ba0160c3/colorLogoPNG_1777488284970.png",
  "description": "Pluto TV Hometown Drama live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-adventure",
  "name": "Pluto TV Adventure",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69d7ebb726eeec84158e28cb.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/69d7ebb726eeec84158e28cb/colorLogoPNG_1777587473079.png",
  "description": "Pluto TV Adventure live on Pluto TV"
},
{
  "id": "pluto-battlestar-galactica",
  "name": "Battlestar Galactica",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69d7ebff029c431826bd328e.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/69d7ebff029c431826bd328e/colorLogoPNG_1776982986391.png",
  "description": "Battlestar Galactica live on Pluto TV"
},
{
  "id": "pluto-pokemon-en-espanol-us",
  "name": "Pok\u00e9mon en espa\u00f1ol",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69e6be40fde57cd5ba562b29.m3u8",
  "category": "Family",
  "logo": "https://images.pluto.tv/channels/69e6be40fde57cd5ba562b29/colorLogoPNG_1777592109830.png",
  "description": "Pok\u00e9mon en espa\u00f1ol live on Pluto TV"
},
{
  "id": "pluto-always-funny",
  "name": "Always Funny",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69eaa34817801c84fca05d94.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/69eaa34817801c84fca05d94/colorLogoPNG_1777656411046.png",
  "description": "Always Funny live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-pride-us",
  "name": "Pluto TV Pride",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-69fa3faab9c0f0d444e64de3.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/69fa3faab9c0f0d444e64de3/colorLogoPNG_1779985115765.png",
  "description": "Pluto TV Pride live on Pluto TV"
},
{
  "id": "pluto-action-drama",
  "name": "Pluto TV Action Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a065830853a01a827f6dd65.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6a065830853a01a827f6dd65/colorLogoPNG_1781131099315.png",
  "description": "Pluto TV Action Drama live on Pluto TV"
},
{
  "id": "pluto-cheers-ptv1",
  "name": "Cheers",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a28827ef4a627f3b07df1ea.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/6a28827ef4a627f3b07df1ea/colorLogoPNG_1781731467139.png",
  "description": "Cheers live on Pluto TV"
},
{
  "id": "pluto-charmed",
  "name": "Charmed",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a2b0d669465b98649cd0ba1.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6a2b0d669465b98649cd0ba1/colorLogoPNG_1782946583491.png",
  "description": "Charmed live on Pluto TV"
},
{
  "id": "pluto-ghost-whisperer",
  "name": "Ghost Whisperer",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a2b0e66c2b638404f0a4ffb.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6a2b0e66c2b638404f0a4ffb/colorLogoPNG_1782946863231.png",
  "description": "Ghost Whisperer live on Pluto TV"
},
{
  "id": "pluto-diagnosis-murder-ptv2",
  "name": "Diagnosis Murder",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a2b0eab9465b98649cd0d2f.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6a2b0eab9465b98649cd0d2f/colorLogoPNG_1782946685197.png",
  "description": "Diagnosis Murder live on Pluto TV"
},
{
  "id": "pluto-touched-by-an-angel",
  "name": "Touched By An Angel",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a2b0edf201df02a8bfea30a.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6a2b0edf201df02a8bfea30a/colorLogoPNG_1782947651184.png",
  "description": "Touched By An Angel live on Pluto TV"
},
{
  "id": "pluto-dr-quinn-medicine-woman",
  "name": "Dr. Quinn, Medicine Woman",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a2b0f2509705ebdf781231d.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/6a2b0f2509705ebdf781231d/colorLogoPNG_1782946772357.png",
  "description": "Dr. Quinn, Medicine Woman live on Pluto TV"
},
{
  "id": "pluto-penn-and-teller-fool-us-cw",
  "name": "Penn & Teller: Fool Us (CW)",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a304723ff3691f8e68a2e74.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6a304723ff3691f8e68a2e74/colorLogoPNG_1790612769194.png",
  "description": "Penn & Teller: Fool Us (CW) live on Pluto TV"
},
{
  "id": "pluto-cw-presents-wwe-nxt",
  "name": "CW Presents WWE NXT",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a30478d0be0264f4a4e227c.m3u8",
  "category": "Sports",
  "logo": "https://images.pluto.tv/channels/6a30478d0be0264f4a4e227c/colorLogoPNG_1789664021838.png",
  "description": "CW Presents WWE NXT live on Pluto TV"
},
{
  "id": "pluto-big-a-anime",
  "name": "Big A Anime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a3c5fa46276c42ac6726b27.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/6a3c5fa46276c42ac6726b27/colorLogoPNG_1785178474278.png",
  "description": "Big A Anime live on Pluto TV"
},
{
  "id": "pluto-jane-the-virgin",
  "name": "Jane the Virgin",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a4bf0a89ad0c6d75edc026b.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6a4bf0a89ad0c6d75edc026b/colorLogoPNG_1785174433318.png",
  "description": "Jane the Virgin live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-royal-drama",
  "name": "Pluto TV Royal Drama",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a4fd96d7652851fb490204f.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6a4fd96d7652851fb490204f/colorLogoPNG_1785178336408.png",
  "description": "Pluto TV Royal Drama live on Pluto TV"
},
{
  "id": "pluto-quirky-af",
  "name": "Quirky AF",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a4fd9f5445cbf6c14ae3ea2.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/6a4fd9f5445cbf6c14ae3ea2/colorLogoPNG_1785175145313.png",
  "description": "Quirky AF live on Pluto TV"
},
{
  "id": "pluto-its-anime",
  "name": "It's Anime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a4fda4538f47f0af402bdb0.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/6a4fda4538f47f0af402bdb0/colorLogoPNG_1787854579734.png",
  "description": "It's Anime live on Pluto TV"
},
{
  "id": "pluto-ghosts",
  "name": "Ghosts",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a5ff6d9c868f8fd984e005c.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/6a5ff6d9c868f8fd984e005c/colorLogoPNG_1785791941652.png",
  "description": "Ghosts live on Pluto TV"
},
{
  "id": "pluto-dora-tv-ptv2",
  "name": "Dora TV",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a70da97a4bf6cded4fdaf53.m3u8",
  "category": "Family",
  "logo": "https://static.wikia.nocookie.net/pluto-tv/images/2/25/Dora_TV_on_Pluto_TV.webp/revision/latest/scale-to-width-down/1227?cb=20250804154117",
  "description": "Dora TV live on Pluto TV"
},
{
  "id": "pluto-celia",
  "name": "Celia",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a722821ff94431f8bfbc260.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6a722821ff94431f8bfbc260/colorLogoPNG_1788451076389.png",
  "description": "Celia live on Pluto TV"
},
{
  "id": "pluto-el-capo",
  "name": "El Capo",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a7228e19307bc770a5b440c.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6a7228e19307bc770a5b440c/colorLogoPNG_1788205371519.png",
  "description": "El Capo live on Pluto TV"
},
{
  "id": "pluto-la-novia-de-estambul",
  "name": "La novia de Estambul",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6a7b7c50307dc8b67b372008.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6a7b7c50307dc8b67b372008/colorLogoPNG_1786477846466.png",
  "description": "La novia de Estambul live on Pluto TV"
},
{
  "id": "pluto-pluto-tv-recent-releases",
  "name": "Pluto TV Recent Releases",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6aa043fe0c9f5239c2c508c2.m3u8",
  "category": "Movies",
  "logo": "https://images.pluto.tv/channels/6aa043fe0c9f5239c2c508c2/colorLogoPNG_1790615745625.png",
  "description": "Pluto TV Recent Releases live on Pluto TV"
},
{
  "id": "pluto-ani-monsters",
  "name": "Ani-Monsters",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6aaadf258cc64f2b2b7dbe3c.m3u8",
  "category": "Kids",
  "logo": "https://images.pluto.tv/channels/6aaadf258cc64f2b2b7dbe3c/colorLogoPNG_1790612859528.png",
  "description": "Ani-Monsters live on Pluto TV"
},
{
  "id": "pluto-aandes-alaska-state-troopers",
  "name": "A&E\u2019s Alaska State Troopers",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6aab1ea02cfd341eb5036c5a.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6aab1ea02cfd341eb5036c5a/colorLogoPNG_1791210755629.png",
  "description": "A&E\u2019s Alaska State Troopers live on Pluto TV"
},
{
  "id": "pluto-aandes-live-pd-greatestshifts",
  "name": "A&E Live PD: Greatest Shifts",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6aab1ec6f2eaa8924745678e.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6aab1ec6f2eaa8924745678e/colorLogoPNG_1790808102594.png",
  "description": "A&E Live PD: Greatest Shifts live on Pluto TV"
},
{
  "id": "pluto-torque-by-history",
  "name": "Torque by History",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6aab1ef220ec28a21adca712.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6aab1ef220ec28a21adca712/colorLogoPNG_1791210850118.png",
  "description": "Torque by History live on Pluto TV"
},
{
  "id": "pluto-pawn-stars-plus-by-history",
  "name": "Pawn Stars Plus by History",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6aab1f18c349e6a78bb489ad.m3u8",
  "category": "Reality",
  "logo": "https://images.pluto.tv/channels/6aab1f18c349e6a78bb489ad/colorLogoPNG_1790808022808.png",
  "description": "Pawn Stars Plus by History live on Pluto TV"
},
{
  "id": "pluto-see-it-now-studios-true-crime",
  "name": "See It Now Studios True Crime",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ac5067030fb504db0658842.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6ac5067030fb504db0658842/colorLogoPNG_1793642003281.png",
  "description": "See It Now Studios True Crime live on Pluto TV"
},
{
  "id": "pluto-bizarre-foods-with-andrew-zimmern",
  "name": "Bizarre Foods with Andrew Zimmern",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad79d62a4021a92c79545a6.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/6ad79d62a4021a92c79545a6/colorLogoPNG_1793381493439.png",
  "description": "Bizarre Foods with Andrew Zimmern live on Pluto TV"
},
{
  "id": "pluto-crime-scenes",
  "name": "Crime Scenes",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad79f775db95e3dac2ae44c.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6ad79f775db95e3dac2ae44c/colorLogoPNG_1793381685424.png",
  "description": "Crime Scenes live on Pluto TV"
},
{
  "id": "pluto-extreme-expeditions",
  "name": "Extreme Expeditions",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a07e13fe741bc260bfe0.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6ad7a07e13fe741bc260bfe0/colorLogoPNG_1793381955505.png",
  "description": "Extreme Expeditions live on Pluto TV"
},
{
  "id": "pluto-how-to",
  "name": "How To",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a1a6887970b5070d3994.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/6ad7a1a6887970b5070d3994/colorLogoPNG_1793382321239.png",
  "description": "How To live on Pluto TV"
},
{
  "id": "pluto-i-almost-got-away-with-it",
  "name": "I (Almost) Got Away With It",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a23d0f04c58afc0110ad.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6ad7a23d0f04c58afc0110ad/colorLogoPNG_1793382563465.png",
  "description": "I (Almost) Got Away With It live on Pluto TV"
},
{
  "id": "pluto-mysterious-worlds",
  "name": "Mysterious Worlds",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a32a91d45be5658a50fa.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/6ad7a32a91d45be5658a50fa/colorLogoPNG_1793382767636.png",
  "description": "Mysterious Worlds live on Pluto TV"
},
{
  "id": "pluto-nikita",
  "name": "Nikita",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a4b9e341f17f18906572.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6ad7a4b9e341f17f18906572/colorLogoPNG_1793382979548.png",
  "description": "Nikita live on Pluto TV"
},
{
  "id": "pluto-niptuck-tbd",
  "name": "Nip/Tuck",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a57b1190f084ae117fe7.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6ad7a57b1190f084ae117fe7/colorLogoPNG_1793384293783.png",
  "description": "Nip/Tuck live on Pluto TV"
},
{
  "id": "pluto-survive-or-die",
  "name": "Survive or Die",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a6a1e341f17f18909399.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6ad7a6a1e341f17f18909399/colorLogoPNG_1793383014828.png",
  "description": "Survive or Die live on Pluto TV"
},
{
  "id": "pluto-the-fbi",
  "name": "The FBI",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a739256eee83f133749e.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6ad7a739256eee83f133749e/colorLogoPNG_1793382331182.png",
  "description": "The FBI live on Pluto TV"
},
{
  "id": "pluto-the-repair-shop",
  "name": "The Repair Shop",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a7be43496b8a1caf7082.m3u8",
  "category": "Lifestyle",
  "logo": "https://images.pluto.tv/channels/6ad7a7be43496b8a1caf7082/colorLogoPNG_1793382170130.png",
  "description": "The Repair Shop live on Pluto TV"
},
{
  "id": "pluto-third-watch",
  "name": "Third Watch",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a8411beb399aadd298d3.m3u8",
  "category": "Series",
  "logo": "https://images.pluto.tv/channels/6ad7a8411beb399aadd298d3/colorLogoPNG_1793382689276.png",
  "description": "Third Watch live on Pluto TV"
},
{
  "id": "pluto-strangely-addicting",
  "name": "Strangely Addicting",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a903a4021a92c795cced.m3u8",
  "category": "Entertainment",
  "logo": "https://images.pluto.tv/channels/6ad7a903a4021a92c795cced/colorLogoPNG_1793382557763.png",
  "description": "Strangely Addicting live on Pluto TV"
},
{
  "id": "pluto-whose-line-is-it-anyway",
  "name": "Whose Line Is It Anyway",
  "url": "/api/proxy-stream?url=https%3A%2F%2Fjmp2.uk%2Fplu-6ad7a97aa9b3de1ec8f609ad.m3u8",
  "category": "Comedy",
  "logo": "https://images.pluto.tv/channels/6ad7a97aa9b3de1ec8f609ad/colorLogoPNG_1793382889086.png",
  "description": "Whose Line Is It Anyway live on Pluto TV"
},
];
