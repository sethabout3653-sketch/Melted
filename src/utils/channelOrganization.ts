import { TVChannel } from '../data/channels';

export interface ChannelClassification {
  category: string;
  subType: string;
  network: string;
  subRank: number;
  categoryRank: number;
}

const CATEGORY_ORDER: Record<string, number> = {
  'Kids': 1,
  'Comedy': 2,
  'Entertainment': 3,
  'Series': 4,
  'Movies': 5,
  'Sports': 6,
  'News': 7,
  'Crime': 8,
  'Documentary': 9,
  'Anime': 10,
  'Sci-Fi & Horror': 11,
  'Reality': 12,
  'Game Show': 13,
  'Lifestyle': 14,
  'Music': 15,
  'Gaming & Tech': 16,
  'Ambiance': 17,
};

const KIDS_NETWORK_REGEX =
  /\b(cartoon network|nickelodeon|nicktoons|nick pluto|nick jr|pbs kids|cbbc|cbeebies|abc kids|abc me|boomerang|kartoon channel|kidoodle|toon goggles|forever kids|happykids|ketchup tv|pop up|tiny pop|tg junior|y[a]{3}s!)\b|^pop(\s|$)/i;

const KIDS_PRESCHOOL_REGEX =
  /\b(baby\s*shark|babyfirst|baby\s*einstein|all babies|peppa\s*pig|dora|teletubbies|blippi|caillou|barney|moonbug|looloo\s*kids|masha\s*&?\s*the\s*bear|pocoyo|super\s*simple|ducktv|little\s*stars|rainbow\s*ruby|rev\s*and\s*roll|sensical\s*jr|mattel\s*jr|mister\s*rogers|strawberry\s*shortcake|maya\s*the\s*bee|zoomoo)\b/i;

const KIDS_CARTOON_REGEX =
  /\b(spongebob|garfield|sonic|mario|transformers|power\s*rangers|pok[eé]mon|yu-gi-oh|grizzy|johnny\s*test|slugterra|rabbids|smurf|dennis\s*and\s*gnasher|pink\s*panther|mr\.?\s*bean\s*animated|go\s*go\s*gadget|hot\s*wheels|my\s*little\s*pony|lego|supertoons|looney|scooby|icarly|90'?s\s*kids|90s\s*kids)\b/i;

const KIDS_GAMING_MAKERS_REGEX =
  /\b(pocket\.watch|ryan\s*and\s*friends|ninja\s*kidz|sensical|video\s*game\s*heroes|batterypop|kids\s*movie\s*club|animated\s*plus|animation\+)\b/i;

const ANIME_REGEX =
  /\b(anime|crunchyroll|hidive|retrocrush|naruto|boruto|one\s*piece|sailor\s*moon|inuyasha|ani-monsters)\b/i;

const FAITH_REGEX =
  /\b(dove|joel\s*osteen|tbn|god\s*tv|ewtn|daystar|faith|hope\s*channel|3abn|christian)\b/i;

const NON_KIDS_EXCLUSION_REGEX =
  /\b(family\s*feud|family\s*ties|family\s*handyman|arizona'?s\s*family|addams\s*family|black\s*family\s*sitcoms|vevo\s*pop|mtv\s*biggest\s*pop|k-?pop|latin\s*pop)\b/i;

export function detectChannelNetwork(channel: TVChannel): string {
  const n = channel.name;
  const d = channel.description || '';

  if (/cartoon network/i.test(n)) return 'Cartoon Network';
  if (/nick\s*jr|nickelodeon|nicktoons|nick pluto|spongebob|dora|icarly/i.test(n)) return 'Nickelodeon';
  if (/pbs\s*kids|pbs|mister\s*rogers/i.test(n)) return 'PBS';
  if (/\b(bbc|cbbc|cbeebies)\b/i.test(n)) return 'BBC';
  if (/\babc\s*(kids|me|news)\b/i.test(n)) return 'ABC';
  if (/\bitv\b/i.test(n)) return 'ITV';
  if (/\bcbc\b/i.test(n)) return 'CBC';
  if (/\bctv\b/i.test(n)) return 'CTV';
  if (/\bsbs\b/i.test(n)) return 'SBS';
  if (/\bfox\b/i.test(n)) return 'FOX';
  if (/\bcbs\b/i.test(n)) return 'CBS';
  if (/\bnbc\b/i.test(n)) return 'NBC';
  if (/pluto tv/i.test(n) || /pluto tv/i.test(d)) return 'Pluto TV';
  if (/samsung tv plus/i.test(d)) return 'Samsung TV Plus';
  if (/the roku channel/i.test(d)) return 'The Roku Channel';
  if (/filmrise/i.test(n)) return 'FilmRise';
  if (/vevo/i.test(n)) return 'Vevo';
  if (/stingray/i.test(n)) return 'Stingray';
  if (/xite/i.test(n)) return 'XITE';
  if (/qvc/i.test(n)) return 'QVC';
  if (/bloomberg/i.test(n)) return 'Bloomberg';
  if (/cgtn/i.test(n)) return 'CGTN';
  if (/france\s*24/i.test(n)) return 'France 24';
  if (/dw\s*english/i.test(n)) return 'Deutsche Welle';
  if (/imported from free-tv/i.test(d)) return channel.category || 'Broadcast';
  return 'Live TV';
}

const classificationCache = new WeakMap<TVChannel, ChannelClassification>();

export function classifyChannel(channel: TVChannel): ChannelClassification {
  const cached = classificationCache.get(channel);
  if (cached) return cached;

  const n = channel.name;
  const rawCat = (channel.category || '').trim();
  const network = detectChannelNetwork(channel);

  let category = '';
  let subType = rawCat || 'Live Channel';
  let subRank = 50;

  const isAnime = ANIME_REGEX.test(n) || rawCat === 'Anime';
  const isFaith = FAITH_REGEX.test(n) || rawCat === 'Faith';
  const isExcludedNonKids = NON_KIDS_EXCLUSION_REGEX.test(n);

  // 1. Auto-classify Anime & Faith first, then ALL genuine Kids channels into "Kids"
  if (isAnime) {
    category = 'Anime';
    subType = 'Anime Series & Movies';
    subRank = 10;
  } else if (isFaith) {
    category = 'Lifestyle';
    subType = 'Faith & Inspiration';
    subRank = 45;
  } else if (!isExcludedNonKids) {
    if (KIDS_NETWORK_REGEX.test(n)) {
      category = 'Kids';
      subType = 'Kids Network';
      subRank = 10;
    } else if (KIDS_PRESCHOOL_REGEX.test(n)) {
      category = 'Kids';
      subType = 'Preschool & Toddler';
      subRank = 20;
    } else if (KIDS_CARTOON_REGEX.test(n)) {
      category = 'Kids';
      subType = 'Cartoons & Animation';
      subRank = 30;
    } else if (KIDS_GAMING_MAKERS_REGEX.test(n)) {
      category = 'Kids';
      subType = /movie/i.test(n) ? 'Kids Movies' : 'Kids & Gaming';
      subRank = 40;
    } else if (
      ['Family & Kids', 'Kids', 'Family', 'Animated'].includes(rawCat) &&
      !/fairground ai/i.test(n)
    ) {
      category = 'Kids';
      subType = rawCat === 'Animated' ? 'Cartoons & Animation' : 'Family & Kids';
      subRank = 35;
    }
  }

  // 2. Auto-classify all remaining categories cleanly
  if (!category) {
    {
      switch (rawCat) {
        case 'Comedy':
        case 'Comedy Drama':
        case 'Dark Comedy':
        case 'Sitcom':
          category = 'Comedy';
          subType = rawCat === 'Comedy' ? 'Comedy & Stand-Up' : rawCat;
          subRank = rawCat === 'Comedy' ? 10 : 20;
          break;
        case 'Movies':
        case 'VOD Movies (EN)':
        case 'Action':
        case 'Western':
        case 'Romance':
        case 'Horror':
          category = 'Movies';
          subType = rawCat === 'VOD Movies (EN)' ? 'Movies On Demand' : rawCat;
          subRank = rawCat === 'Movies' || rawCat === 'VOD Movies (EN)' ? 10 : 20;
          break;
        case 'Series':
        case 'Drama':
          category = 'Series';
          subType = rawCat === 'Drama' ? 'Drama Series' : '24/7 Series';
          subRank = 10;
          break;
        case 'Sports':
        case '3X3 Basketball':
        case 'Action Sports':
        case 'Auto & Motorsports':
        case 'Baseball':
        case 'Basketball':
        case 'Bowling':
        case 'Bullfighting':
        case 'Football':
        case 'Golf':
        case 'Hunting':
        case 'Pro Wrestling':
          category = 'Sports';
          subType = rawCat === 'Sports' ? 'Live Sports' : rawCat;
          subRank = rawCat === 'Sports' ? 10 : 20;
          break;
        case 'News':
        case 'Weather':
        case 'Business':
        case 'Bus./Financial':
          category = 'News';
          subType = rawCat === 'News' ? 'Live News' : rawCat === 'Bus./Financial' ? 'Business & Finance' : rawCat;
          subRank = rawCat === 'News' ? 10 : 20;
          break;
        case 'Crime':
        case 'Law':
          category = 'Crime';
          subType = rawCat === 'Law' ? 'Court & Law' : 'True Crime & Mystery';
          subRank = rawCat === 'Crime' ? 10 : 20;
          break;
        case 'Documentary':
        case 'Documentaries (EN)':
        case 'Nature':
        case 'Animals':
        case 'Environment':
        case 'Biography':
        case 'Educational':
          category = 'Documentary';
          subType = rawCat === 'Documentaries (EN)' ? 'Documentaries' : rawCat;
          subRank = rawCat === 'Documentary' || rawCat === 'Documentaries (EN)' ? 10 : 20;
          break;
        case 'Music':
        case 'Music (EN)':
        case 'Music Talk':
          category = 'Music';
          subType = rawCat === 'Music Talk' ? 'Music Talk' : 'Music Videos & Hits';
          subRank = 10;
          break;
        case 'Sci-Fi & Horror':
        case 'Science Fiction':
        case 'Paranormal':
          category = 'Sci-Fi & Horror';
          subType = rawCat;
          subRank = 10;
          break;
        case 'Game Show':
        case 'Card Games':
          category = 'Game Show';
          subType = rawCat;
          subRank = 10;
          break;
        case 'Gaming':
        case 'Gaming & Tech':
        case 'Computers':
          category = 'Gaming & Tech';
          subType = rawCat;
          subRank = 10;
          break;
        case 'Reality':
          category = 'Reality';
          subType = 'Reality TV';
          subRank = 10;
          break;
        case 'Lifestyle':
        case 'Health':
        case 'Art':
        case 'Auction':
        case 'Shopping':
          category = 'Lifestyle';
          subType = rawCat;
          subRank = 15;
          break;
        case 'Ambiance':
          category = 'Ambiance';
          subType = 'Ambient & Visuals';
          subRank = 10;
          break;
        default: {
          // Country-grouped broadcast channels (UK, USA, Australia, Canada, Ireland, etc.) -> auto-classify by name!
          if (/\b(news|weather|bloomberg|cnbc|sky|reuters|gb news|euronews|al jazeera|nhk)\b/i.test(n)) {
            category = 'News';
            subType = `${rawCat} News`;
            subRank = 15;
          } else if (/\b(sport|sports|racing|golf|football|soccer|boxing|wrestling|cricket|rugby)\b/i.test(n)) {
            category = 'Sports';
            subType = `${rawCat} Sports`;
            subRank = 15;
          } else if (/\b(crime|court|detective|forensic|mystery)\b/i.test(n)) {
            category = 'Crime';
            subType = `${rawCat} Crime`;
            subRank = 15;
          } else if (/\b(movie|movies|cinema|film|film4|great!)\b/i.test(n)) {
            category = 'Movies';
            subType = `${rawCat} Movies`;
            subRank = 15;
          } else if (/\b(music|radio|fm|hits|now 80|now 90|now 70|mtv|kerrang)\b/i.test(n)) {
            category = 'Music';
            subType = `${rawCat} Music`;
            subRank = 15;
          } else if (/\b(comedy|dave|gold)\b/i.test(n)) {
            category = 'Comedy';
            subType = `${rawCat} Comedy`;
            subRank = 15;
          } else if (/\b(doc|history|eden|earth|nature)\b/i.test(n)) {
            category = 'Documentary';
            subType = `${rawCat} Docs`;
            subRank = 15;
          } else if (/\b(qvc|shop|ideal world|tvsn|hsn|food|home|garden)\b/i.test(n)) {
            category = 'Lifestyle';
            subType = `${rawCat} Lifestyle`;
            subRank = 20;
          } else {
            category = 'Entertainment';
            subType = ['UK', 'USA', 'Australia', 'Canada', 'Ireland', 'Nigeria', 'Kenya', 'Trinidad', 'Malta'].includes(rawCat)
              ? `${rawCat} Broadcast`
              : 'General Entertainment';
            subRank = 20;
          }
          break;
        }
      }
    }
  }

  const result: ChannelClassification = {
    category,
    subType,
    network,
    subRank,
    categoryRank: CATEGORY_ORDER[category] ?? 99,
  };
  classificationCache.set(channel, result);
  return result;
}

export function compareClassifiedChannels(a: TVChannel, b: TVChannel, isAllView: boolean): number {
  const ca = classifyChannel(a);
  const cb = classifyChannel(b);

  if (isAllView && ca.categoryRank !== cb.categoryRank) {
    return ca.categoryRank - cb.categoryRank;
  }
  if (ca.subRank !== cb.subRank) {
    return ca.subRank - cb.subRank;
  }
  const netCmp = ca.network.localeCompare(cb.network);
  if (netCmp !== 0 && (ca.category === 'Kids' || ca.network !== 'Live TV' || cb.network !== 'Live TV')) {
    // Keep famous kids networks together (Cartoon Network, Nickelodeon, PBS, BBC, ABC) before generic platform grouping
    const priorityNet = (net: string) => {
      if (['Cartoon Network', 'Nickelodeon', 'PBS', 'BBC', 'ABC'].includes(net)) return 0;
      if (net === 'Pluto TV') return 1;
      if (net === 'The Roku Channel') return 2;
      if (net === 'Samsung TV Plus') return 3;
      return 4;
    };
    const pDiff = priorityNet(ca.network) - priorityNet(cb.network);
    if (pDiff !== 0) return pDiff;
    if (netCmp !== 0) return netCmp;
  }
  return a.name.localeCompare(b.name);
}
