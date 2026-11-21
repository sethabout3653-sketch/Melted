export interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
  desc?: string;
  rating?: string;
  category?: string;
  episode?: string;
}

export interface ChannelNowNext {
  now?: EpgProgramme;
  next?: EpgProgramme;
}

export interface EpgChannelMeta {
  id: string;
  name: string;
  category: string;
  subType?: string;
  description?: string;
  plutoId?: string;
}

export function normalizeTitleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function stripCircledSymbols(name: string): string {
  return name.replace(/[\u24B6-\u24E9]/g, '').trim();
}

export function normalizeRatingBadge(raw: string): string | undefined {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!clean || clean === 'NA' || clean === 'N/A' || clean === 'NONE' || clean === 'UNRATED' || clean === 'UNKNOWN' || clean === 'NR' || clean === '-') {
    return undefined;
  }
  const table: Record<string, string> = {
    TVY: 'TV-Y',
    'TV-Y': 'TV-Y',
    Y: 'TV-Y',
    C: 'TV-Y',
    P: 'TV-Y',
    TVY7: 'TV-Y7',
    'TV-Y7': 'TV-Y7',
    TVY7FV: 'TV-Y7',
    'TV-Y7-FV': 'TV-Y7',
    Y7: 'TV-Y7',
    C8: 'TV-Y7',
    '7': 'TV-Y7',
    '7+': 'TV-Y7',
    '8': 'TV-Y7',
    FSK6: 'TV-Y7',
    '6': 'TV-Y7',
    '6+': 'TV-Y7',
    TVG: 'TV-G',
    'TV-G': 'TV-G',
    G: 'G',
    U: 'TV-G',
    AL: 'TV-G',
    ALL: 'TV-G',
    TP: 'TV-G',
    T: 'TV-G',
    L: 'TV-G',
    KT: 'TV-G',
    FSK0: 'TV-G',
    '0': 'TV-G',
    '3': 'TV-G',
    '4': 'TV-G',
    '5': 'TV-G',
    TVPG: 'TV-PG',
    'TV-PG': 'TV-PG',
    PG: 'PG',
    PG8: 'TV-PG',
    M: 'TV-PG',
    '9': 'TV-PG',
    '10': 'TV-PG',
    '10+': 'TV-PG',
    '11': 'TV-PG',
    '12': 'TV-PG',
    '12+': 'TV-PG',
    '12A': 'PG-13',
    FSK12: 'TV-PG',
    PG13: 'PG-13',
    'PG-13': 'PG-13',
    '13': 'PG-13',
    '13+': 'PG-13',
    TV14: 'TV-14',
    'TV-14': 'TV-14',
    '14': 'TV-14',
    '14+': 'TV-14',
    '14A': 'TV-14',
    VM14: 'TV-14',
    '15': 'TV-14',
    '15+': 'TV-14',
    '16': 'TV-14',
    '16+': 'TV-14',
    FSK16: 'TV-14',
    MA15: 'TV-14',
    'MA15+': 'TV-14',
    'AV15+': 'TV-14',
    TVMA: 'TV-MA',
    'TV-MA': 'TV-MA',
    R: 'R',
    NC17: 'NC-17',
    'NC-17': 'NC-17',
    '18': 'TV-MA',
    '18+': 'TV-MA',
    '18A': 'TV-MA',
    'R18+': 'TV-MA',
    M18: 'TV-MA',
    R21: 'TV-MA',
    VM18: 'TV-MA',
    FSK18: 'TV-MA',
  };
  return table[clean] || (/^(TV-Y|TV-Y7|TV-G|TV-PG|TV-14|TV-MA|G|PG|PG-13|R|NC-17)$/.test(clean) ? clean : undefined);
}

const CURATED_RULES: Array<{ pattern: RegExp; rating: string }> = [
  // Preschool (TV-Y)
  {
    pattern: /\b(peppa pig|barney|daniel tiger|curious george|dora the explorer|dora|blue'?s clues|bubble guppies|paw patrol|teletubbies|blippi|caillou|cocomelon|baby shark|masha and the bear|pocoyo|sesame street|super simple|elmo|elena wonders|elinor wonders why|donkey hodie|molly of denali|alma'?s way|work it out wombats|lyla in the loop|pinkalicious|thomas & friends|bob the builder|strawberry shortcake|maya the bee|wiggles|star wars:? young jedi adventures|young jedi adventures|princess play time|phoebe & jay|timmy time|hogie the globehopper|counting with paula|berry and dolly)\b/i,
    rating: 'TV-Y',
  },
  // Kids Action / Cartoons (TV-Y7)
  {
    pattern: /\b(spongebob|avatar:? the last airbender|legend of korra|teenage mutant ninja turtles|tmnt|teen titans|ben 10|adventure time|regular show|amazing world of gumball|gumball|craig of the creek|power rangers|pok[eé]mon|yu-gi-oh|beyblade|transformers|sonic|mario|johnny test|grizzy|rabbids|smurfs|looney tunes|scooby-doo|scooby doo|inspector gadget|pink panther|arthur|wild kratts|xavier riddle|loud house|fairly oddparents|danny phantom|rugrats|hey arnold|animaniacs|garfield)\b/i,
    rating: 'TV-Y7',
  },
  // Family / General Audiences (TV-G)
  {
    pattern: /\b(price is right|wheel of fortune|jeopardy|let'?s make a deal|this old house|antiques roadshow|addams family|mr\.? bean|bob ross|joy of painting|iron chef|good eats|pioneer woman|essence of emeril|cook'?s country|america'?s test kitchen|lidia'?s kitchen|homes under the hammer|escape to the country|property brothers|tiny house|say yes to the dress|how it'?s made|planetary|nasa|cosmos|opry live|grand ole opry|bloomberg originals|take charge)\b/i,
    rating: 'TV-G',
  },
  // Teen / Classic Sitcoms / Reality / Game Shows / Softer Crime (TV-PG)
  {
    pattern: /\b(everybody hates chris|seinfeld|frasier|cheers|friends|roseanne|the jeffersons|three'?s company|all in the family|golden girls|home improvement|degrassi|touched by an angel|dr\.? quinn|highway to heaven|heartland|midsomer murders|columbo|murder, she wrote|matlock|perry mason|monk|psych|doc martin|doctor who|top gear|mst3k|mystery science theater|rifftrax|family feud|deal or no deal|wipeout|storage wars|pawn stars|american pickers|duck dynasty|four in a bed|come dine with me|baywatch|walker, texas ranger|hercules|xena|stargate|star trek|farscape|quantum leap|sliders|dateline|48 hours|unsolved mysteries|american greed|wwe|nxt|tna|impact wrestling|aew|how the universe works|modern marvels|mega structures)\b/i,
    rating: 'TV-PG',
  },
  // TV-14 Shows / Crime / Reality / Anime / Action
  {
    pattern: /\b(rick and morty|family guy|american dad|futurama|bob'?s burgers|king of the hill|archer|hell'?s kitchen|kitchen nightmares|masterchef|hotel hell|bar rescue|forensic files|cold case files|the new detectives|first 48|snapped|on patrol:? live|live pd|cops|jail|cheaters|maury|steve wilkos|jerry springer|dog the bounty hunter|1000 ways to die|flavor of love|love & hip hop|love and hip hop|black ink crew|the challenge|wild '?n out|mtv cribs|catfish|teen mom|bad girls club|naruto|one piece|bleach|dragon ball|attack on titan|hunter x hunter|my hero academia|demon slayer|jujutsu kaisen|death note|cowboy bebop|inuyasha|ufc|bellator|pfl|boxing|championship boxing|fbi:? international|law & order|csi|ncis|criminal minds|bones|house|buffy|angel|supernatural|charmed|x-files|x files|twilight zone|outer limits|40 days and nights|last eyewitness)\b/i,
    rating: 'TV-14',
  },
  // TV-MA Series
  {
    pattern: /\b(south park|robot chicken|metalocalypse|aqua teen|superjail|the boondocks|boondocks|moral orel|mr\.? pickles|smiling friends|breaking bad|better call saul|game of thrones|house of the dragon|succession|the sopranos|sopranos|the wire|the boys|peacemaker|fargo|dexter|true detective|walking dead|fear the walking dead|american horror story|yellowjackets|euphoria|ozark|narcos|sons of anarchy|mayans m\.c\.|spartacus|shameless|californication|entourage|deadwood|boardwalk empire|weeds)\b/i,
    rating: 'TV-MA',
  },
  // Notable Movies (MPAA)
  {
    pattern: /\b(braveheart|pulp fiction|fight club|terminator|the matrix|matrix|die hard|deadpool|goodfellas|scarface|godfather|saving private ryan|gladiator|john wick|mad max|supercop|enemy of the state|the postcard killings|lords of salem|the street fighter|friday the 13th|nightmare on elm street|halloween|saw\b|scream\b|texas chainsaw|child'?s play|evil dead|alien\b|aliens\b|predator|robocop|total recall|blade runner|reservoir dogs|kill bill|django unchained|inglourious basterds|no country for old men|there will be blood|se7en|seven\b|silence of the lambs|the shining|exorcist)\b/i,
    rating: 'R',
  },
  {
    pattern: /\b(grease|the dark knight|inception|interstellar|avengers|iron man|spider-man|batman|superman|jurassic park|indiana jones|star wars|pirates of the caribbean|lord of the rings|hobbit|harry potter|hunger games|twilight|back to the future|ghostbusters|men in black|top gun|mission:? impossible|james bond|goldeneye|casino royale|skyfall|transformers|fast & furious|fast and furious|the sixth sense|signs)\b/i,
    rating: 'PG-13',
  },
  {
    pattern: /\b(mac and me|shrek|toy story|finding nemo|monsters, inc|incredibles|frozen|moana|encanto|coco|ratatouille|up\b|wall-e|kung fu panda|how to train your dragon|despicable me|minions|home alone|elf\b|mrs\.? doubtfire|jumanji|princess bride|hook\b|matilda|paddington|bee movie|ice age|madagascar|the goonies|e\.t\.|wizard of oz)\b/i,
    rating: 'PG',
  },
];

export function getCuratedTitleRating(title: string): string | undefined {
  if (!title) return undefined;
  for (const rule of CURATED_RULES) {
    if (rule.pattern.test(title)) {
      return rule.rating;
    }
  }
  return undefined;
}

export function getChannelAwareFallbackRating(
  channelInfo: { id?: string; name?: string; category?: string; subType?: string },
  title?: string,
  progCategory?: string
): string {
  const chId = (channelInfo.id || '').toLowerCase();
  const chName = (channelInfo.name || '').toLowerCase();
  const chCat = (channelInfo.category || '').toLowerCase();
  const subType = (channelInfo.subType || '').toLowerCase();
  const pCat = (progCategory || '').toLowerCase();
  const t = (title || '').toLowerCase();

  // Channel-specific strict ratings
  if (chId === 'south-park-247' || chName.includes('south park') || chId === 'adult-swim' && /robot chicken|aqua teen|superjail|metalocalypse|boondocks|smiling friends/.test(t)) {
    return 'TV-MA';
  }
  if (chId === 'adult-swim' || chName.includes('adult swim')) return 'TV-14';
  if (chId === 'pbs-kids' || chId === 'baby-shark-tv' || chId === 'babyfirst' || chId === 'abckids-au-r2v' || subType.includes('preschool') || /\b(baby|toddler|nick jr|cbeebies|peppa|dora|teletubbies|moonbug|little stars|pbs kids|forever kids|abc kids|tg junior|toys and colors)\b/i.test(chName)) {
    return 'TV-Y';
  }
  if (chCat.includes('kids') || chCat.includes('family') || subType.includes('cartoon') || /\b(cartoon network|nickelodeon|nicktoons|boomerang|cbbc|abc me|boing|teen|pop|kidoodle|toon)\b/i.test(chName)) {
    return 'TV-Y7';
  }
  if (
    chCat === 'news' ||
    chCat === 'music' ||
    chCat === 'ambiance' ||
    chCat === 'shopping' ||
    chCat === 'educational' ||
    pCat.includes('news') ||
    pCat.includes('weather') ||
    pCat.includes('cooking') ||
    pCat.includes('food') ||
    pCat.includes('travel') ||
    pCat.includes('home') ||
    pCat.includes('music') ||
    /\b(news|radio|fm|bbc world|france 24|dw |cgtn|al jazeera|nhk|bloomberg|reuters|cnbc|msnbc|cnn|fox news|sky news|newstalk|qvc|hsn|gemstv|tvsn|fireplace|naturescape|stingray|vevo|xite|food|cooking|kitchen|this old house|weather|oireachtas|parliament|cpac|educational)\b/i.test(chName + ' ' + t)
  ) {
    return 'TV-G';
  }
  if (
    /\b(terror|horror|slasher|grindhouse|uncensored|gore|twisted)\b/i.test(chName + ' ' + pCat + ' ' + t) ||
    chId.includes('terror') ||
    chId.includes('asylum')
  ) {
    return 'TV-MA';
  }
  if (
    chCat === 'crime' ||
    chCat === 'sci-fi & horror' ||
    pCat.includes('crime') ||
    pCat.includes('horror') ||
    pCat.includes('mystery') ||
    pCat.includes('thriller') ||
    /\b(crime|murder|forensic|detective|cold case|patrol|cops|jail|cheaters|bounty|ufc|mma|boxing|fight|bellator|wrestling|horror|sci-fi|thriller|action|dark|court)\b/i.test(chName + ' ' + pCat)
  ) {
    return 'TV-14';
  }
  if (chCat === 'anime' || pCat.includes('anime')) {
    return /\b(naruto|sailor moon|pok[eé]mon|yu-gi-oh|digimon)\b/i.test(t) ? 'TV-PG' : 'TV-14';
  }
  if (chCat === 'sports' || pCat.includes('sport')) {
    return /\b(boxing|ufc|mma|fight|wrestling|wwe|tna|aew|poker|bull)\b/i.test(chName + ' ' + t) ? 'TV-PG' : 'TV-G';
  }
  if (chCat === 'game show' || pCat.includes('game show')) {
    return /\b(feud|deal|chase|jeopardy|wheel|price|buzzr|game show)\b/i.test(chName + ' ' + t) ? 'TV-G' : 'TV-PG';
  }
  if (chCat === 'lifestyle' || chCat === 'documentary' || chCat === 'documentaries (en)' || chCat === 'gaming & tech') {
    if (/\b(war|crime|murder|combat|forensic)\b/i.test(chName + ' ' + t)) return 'TV-14';
    if (/\b(pbs|ket|educational|history & science)\b/i.test(chName + ' ' + t)) return 'TV-G';
    return /\b(survival|disaster|history|science|space|nature|animal|diy|home|garden|food)\b/i.test(chName + ' ' + t)
      ? 'TV-PG'
      : 'TV-G';
  }
  if (chCat === 'movies' || chCat === 'vod movies (en)' || pCat.includes('movie') || pCat.includes('film')) {
    return /\b(action|thriller|crime|fight|warrior|blood|kill|dead|nightmare|terror)\b/i.test(t) ? 'R' : 'PG-13';
  }

  return 'TV-PG';
}

export function resolveAccurateProgrammeRating(
  programme: EpgProgramme,
  channelInfo: { id?: string; name?: string; category?: string; subType?: string },
  tmdbRatings?: Map<string, string | undefined> | Record<string, string | undefined>
): string {
  const chName = (channelInfo.name || '').toLowerCase();
  const chId = (channelInfo.id || '').toLowerCase();
  const chCat = (channelInfo.category || '').toLowerCase();
  const isPreschoolChannel =
    chId === 'pbs-kids' ||
    chId === 'baby-shark-tv' ||
    chId === 'babyfirst' ||
    chId === 'abckids-au-r2v' ||
    /\b(baby|toddler|nick jr|cbeebies|pbs kids|abc kids|tg junior|toys and colors)\b/i.test(chName);
  const isKidsChannel =
    isPreschoolChannel ||
    ((chCat.includes('kids') || /\b(cartoon network|nickelodeon|nicktoons|boomerang|cbbc|abc me|boing)\b/i.test(chName)) &&
      !chName.includes('animation+') &&
      !chId.includes('adult-swim'));

  // 1. Check curated show/movie dictionary first for exact accuracy on known franchises
  const curated = getCuratedTitleRating(programme.title);
  if (curated) return curated;

  // Lookup TMDB cached rating if available
  const key = normalizeTitleKey(programme.title);
  const tmdbVal = key && tmdbRatings ? (tmdbRatings instanceof Map ? tmdbRatings.get(key) : tmdbRatings[key]) : undefined;
  const normTmdb = tmdbVal ? normalizeRatingBadge(tmdbVal) : undefined;

  // 2. Check normalized XMLTV / provider rating if genuine & consistent with channel
  const existing = programme.rating ? normalizeRatingBadge(programme.rating) : undefined;
  if (existing) {
    // Kids/Preschool channels shouldn't emit TV-14/TV-MA/R from mismatched EU/Samsung DVB tags
    if (isPreschoolChannel && ['TV-14', 'TV-MA', 'R', 'NC-17', 'PG-13'].includes(existing)) {
      return normTmdb && ['TV-Y', 'TV-Y7', 'TV-G', 'G', 'PG'].includes(normTmdb) ? normTmdb : 'TV-Y';
    }
    if (isKidsChannel && ['TV-MA', 'R', 'NC-17'].includes(existing)) {
      return normTmdb && ['TV-Y', 'TV-Y7', 'TV-G', 'G', 'PG', 'TV-PG'].includes(normTmdb) ? normTmdb : 'TV-Y7';
    }
    // Non-Kids adult/arts/news/documentary channels converting EU "7"/"8" age codes to "TV-Y7"
    if (!isKidsChannel && (existing === 'TV-Y' || existing === 'TV-Y7')) {
      return normTmdb || getChannelAwareFallbackRating(channelInfo, programme.title, programme.category);
    }
    if (existing === 'TV-PG' && normTmdb) {
      return normTmdb;
    }
    return existing;
  }

  // 3. Check TMDB resolved rating cache
  if (normTmdb) return normTmdb;

  // 4. Channel + category + title-aware accurate fallback (always non-empty!)
  return getChannelAwareFallbackRating(channelInfo, programme.title, programme.category);
}

const PBS_KIDS_SHOWS = [
  { title: "Daniel Tiger's Neighborhood", desc: "Explore life's little lessons with Daniel Tiger and friends.", rating: 'TV-Y' },
  { title: "Curious George", desc: "Join everyone's favorite curious monkey on educational adventures.", rating: 'TV-Y' },
  { title: "Wild Kratts", desc: "Chris and Martin Kratt dive into creature habitats around the world.", rating: 'TV-Y7' },
  { title: "Alma's Way", desc: "Alma Rivera speaks up, listens to others, and solves problems in the Bronx.", rating: 'TV-Y' },
  { title: "Lyla in the Loop", desc: "Lyla, her blue sidekick Stu, and her family tackle creative problem-solving.", rating: 'TV-Y' },
  { title: "Work It Out Wombats!", desc: "Malik, Zadie, and Hamilton practice computational thinking in the Treeborhood.", rating: 'TV-Y' },
  { title: "Pinkalicious & Peterrific", desc: "Inspiring kids to engage in the arts and self-expression.", rating: 'TV-Y' },
  { title: "Elinor Wonders Why", desc: "Elinor and her pals explore nature, curiosity, and asking why.", rating: 'TV-Y' },
  { title: "Donkey Hodie", desc: "Empowering preschoolers to be resourceful and resilient problem solvers.", rating: 'TV-Y' },
  { title: "Xavier Riddle and the Secret Museum", desc: "Xavier and friends travel back in time to meet historical heroes.", rating: 'TV-Y7' },
  { title: "Molly of Denali", desc: "Molly shares her life in rural Alaska with humor and resourcefulness.", rating: 'TV-Y' },
  { title: "Arthur", desc: "Classic animated adventures with Arthur Read and friends in Elwood City.", rating: 'TV-Y' },
];

export function buildChannelFallbackSchedule(
  ch: { id: string; name: string; category?: string; subType?: string; description?: string },
  nowMs: number = Date.now()
): EpgProgramme[] {
  const hourStart = Math.floor(nowMs / 3600_000) * 3600_000;
  const cleanName = stripCircledSymbols(ch.name);
  const cat = (ch.category || '').trim();
  const subType = (ch.subType || '').trim();
  const isRadio = /\b(fm|radio|newstalk|spin 103|classic hits|106\.8|98fm|q102|fm104)\b/i.test(cleanName);
  const isNews = cat === 'News' || /\b(news|oireachtas|parliament|al jazeera|cgtn|france 24|dw |antena 3)\b/i.test(cleanName);

  if (ch.id === 'pbs-kids') {
    const slot = Math.floor(nowMs / 1800_000);
    const out: EpgProgramme[] = [];
    const baseStart = slot * 1800_000;
    for (let i = 0; i < 6; i++) {
      const show = PBS_KIDS_SHOWS[(slot + i) % PBS_KIDS_SHOWS.length];
      out.push({
        title: show.title,
        start: baseStart + i * 1800_000,
        stop: baseStart + (i + 1) * 1800_000,
        desc: show.desc,
        category: 'Kids',
        rating: show.rating,
      });
    }
    return out;
  }

  let titles: [string, string, string];
  if (isRadio) {
    titles = [`${cleanName} — Live Radio`, `${cleanName} — Continuous Music & Talk`, `${cleanName} — Evening Mix`];
  } else if (isNews) {
    titles = [`${cleanName} — Live News Coverage`, `${cleanName} — World Report & Analysis`, `${cleanName} — Breaking Headlines`];
  } else if (cat === 'Kids' || subType.includes('Kids') || subType.includes('Preschool')) {
    titles = [`${cleanName} — Kids Programming`, `${cleanName} — Animated Favorites`, `${cleanName} — Family Time`];
  } else if (cat === 'Sports') {
    titles = [`${cleanName} — Live Sports & Highlights`, `${cleanName} — Action Replay`, `${cleanName} — Championship Showcase`];
  } else if (cat === 'Documentary' || cat === 'Documentaries (EN)' || cat === 'Educational') {
    titles = [`${cleanName} — Documentary Feature`, `${cleanName} — Exploring History & Science`, `${cleanName} — Special Presentation`];
  } else if (cat === 'Gaming & Tech') {
    titles = [`${cleanName} — Featured Episodes`, `${cleanName} — Creator Marathon`, `${cleanName} — Highlights & Challenges`];
  } else if (cat === 'Music') {
    titles = [`${cleanName} — Non-Stop Music Videos`, `${cleanName} — Top Hits & Classics`, `${cleanName} — Live Sessions`];
  } else if (cat === 'Movies' || cat === 'VOD Movies (EN)') {
    titles = [`${cleanName} — Feature Presentation`, `${cleanName} — Movie Marathon`, `${cleanName} — Double Feature`];
  } else {
    titles = [`${cleanName} — Featured Broadcast`, `${cleanName} — Continuing Programming`, `${cleanName} — Next Showcase`];
  }

  const out: EpgProgramme[] = [];
  for (let i = 0; i < 4; i++) {
    const title = titles[i % titles.length];
    const start = hourStart + i * 3600_000;
    const stop = start + 3600_000;
    const rating = getChannelAwareFallbackRating({ id: ch.id, name: cleanName, category: cat, subType }, title);
    out.push({
      title,
      start,
      stop,
      desc: ch.description || `Broadcast programming on ${cleanName}.`,
      category: cat || 'Entertainment',
      rating,
    });
  }
  return out;
}
