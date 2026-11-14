import { TVChannel } from '../data/channels';
import { classifyChannel } from './channelOrganization';

interface IndexedChannel {
  channel: TVChannel;
  nameLower: string;
  catLower: string;
  descLower: string;
  fullText: string;
  words: string[];
  nameWords: Set<string>;
  catWords: Set<string>;
  descWords: Set<string>;
}

const TOPIC_CLUSTERS: string[][] = [
  [
    'cartoon', 'cartoons', 'animation', 'animated', 'anime', 'toon', 'toons', 'kids', 'children',
    'family', 'superhero', 'comics', 'baby', 'toddler', 'preschool'
  ],
  [
    'comedy', 'funny', 'humor', 'humour', 'laugh', 'laughs', 'joke', 'jokes', 'sitcom', 'sitcoms',
    'standup', 'stand-up', 'improv', 'parody', 'satire', 'prank', 'pranks', 'fail', 'fails',
    'dark comedy', 'comedy drama'
  ],
  [
    'crime', 'true crime', 'mystery', 'mysteries', 'detective', 'forensic', 'forensics', 'murder',
    'homicide', 'police', 'cop', 'cops', 'court', 'judge', 'law', 'legal', 'investigation',
    'cold case', 'unsolved', 'prison', 'jail', 'thriller', 'thrillers'
  ],
  [
    'horror', 'scary', 'spooky', 'creepy', 'terror', 'scream', 'ghost', 'ghosts', 'haunted',
    'paranormal', 'supernatural', 'monster', 'monsters', 'zombie', 'zombies', 'vampire', 'slasher',
    'halloween', 'ufo', 'ufos', 'alien', 'aliens', 'sci-fi', 'scifi', 'science fiction', 'fantasy'
  ],
  [
    'news', 'breaking', 'headlines', 'journalism', 'politics', 'political', 'government', 'election',
    'world', 'local', 'business', 'finance', 'financial', 'stocks', 'market', 'economy', 'money',
    'weather', 'storm', 'storms', 'forecast', 'climate'
  ],
  [
    'sports', 'sport', 'athletics', 'football', 'soccer', 'basketball', 'baseball', 'hockey', 'golf',
    'tennis', 'boxing', 'fighting', 'combat', 'wrestling', 'motorsport', 'motorsports', 'racing',
    'race', 'fishing', 'hunting', 'outdoors', 'billiards', 'bowling', 'olympics', 'action sports',
    'stadium'
  ],
  [
    'movie', 'movies', 'film', 'films', 'cinema', 'blockbuster', 'theater', 'theatre', 'action',
    'adventure', 'western', 'westerns', 'cowboy', 'romance', 'romantic', 'romcom', 'love',
    'drama', 'classic', 'classics', 'indie', 'thriller'
  ],
  [
    'food', 'cooking', 'cook', 'chef', 'chefs', 'kitchen', 'recipe', 'recipes', 'baking', 'bake',
    'restaurant', 'culinary', 'travel', 'home', 'house', 'garden', 'diy', 'renovation',
    'design', 'interior', 'fashion', 'style', 'beauty', 'lifestyle', 'pop culture', 'shopping', 'auction'
  ],
  [
    'nature', 'wildlife', 'animals', 'animal', 'pet', 'pets', 'dog', 'dogs', 'puppy', 'puppies',
    'cat', 'cats', 'kitten', 'ocean', 'sea', 'earth', 'planet', 'environment', 'science', 'space',
    'astronomy', 'history', 'historical', 'biography', 'documentary', 'documentaries', 'doc',
    'docs', 'educational', 'education', 'learning', 'wild'
  ],
  [
    'music', 'song', 'songs', 'hits', 'pop', 'rock', 'hip-hop', 'hiphop', 'rap', 'country', 'jazz',
    'r&b', 'electronic', 'dance', 'edm', '80s', '90s', '2000s', 'throwback', 'karaoke', 'concert',
    'concerts', 'radio', 'ambient', 'ambiance', 'chill', 'lofi', 'relax', 'relaxing', 'fireplace', 'sleep'
  ],
  [
    'gaming', 'game', 'games', 'esports', 'gamer', 'gamers', 'videogames', 'video games', 'tech',
    'technology', 'computer', 'computers', 'geek', 'nerd', 'retro'
  ],
  [
    'reality', 'reality tv', 'dating', 'competition', 'contest', 'game show', 'game shows', 'trivia',
    'quiz', 'talk', 'talk show', 'celebrity', 'gossip', 'entertainment', 'series'
  ]
];

const STOP_WORDS = new Set([
  'tv', 'channel', 'channels', 'show', 'shows', 'stream', 'streams', 'live',
  'watch', 'video', 'videos', 'the', 'and', 'for', 'with', 'about', 'like', 'similar', 'to', 'of', 'a', 'an', 'in', 'on'
]);

const TERM_TO_CLUSTER_TERMS = new Map<string, string[]>();
for (const cluster of TOPIC_CLUSTERS) {
  for (const term of cluster) {
    const existing = TERM_TO_CLUSTER_TERMS.get(term) || [];
    for (const related of cluster) {
      if (related !== term && !existing.includes(related)) {
        existing.push(related);
      }
    }
    TERM_TO_CLUSTER_TERMS.set(term, existing);
  }
}

const channelIndexCache = new WeakMap<TVChannel, IndexedChannel>();

function tokenizeWords(text: string): string[] {
  return text.split(/[^a-z0-9&-]+/).filter((w) => w.length >= 2);
}

function cleanBoilerplateDesc(desc: string): string {
  return desc
    .replace(/\bimported from (free-tv|roku|samsung):\s*/gi, '')
    .replace(/\blive on pluto tv\b/gi, '')
    .trim();
}

function getIndexedChannel(channel: TVChannel): IndexedChannel {
  const cached = channelIndexCache.get(channel);
  if (cached) return cached;

  const meta = classifyChannel(channel);
  const nameLower = channel.name.toLowerCase();
  const catLower = `${meta.category} ${meta.subType} ${channel.category}`.toLowerCase();
  const descLower = `${cleanBoilerplateDesc(channel.description || '')} ${meta.network}`.toLowerCase();
  const fullText = `${nameLower} ${catLower} ${descLower}`;
  const nameWordsList = tokenizeWords(nameLower);
  const catWordsList = tokenizeWords(catLower);
  const descWordsList = tokenizeWords(descLower);
  const words = Array.from(new Set([...nameWordsList, ...catWordsList, ...descWordsList]));

  const indexed: IndexedChannel = {
    channel,
    nameLower,
    catLower,
    descLower,
    fullText,
    words,
    nameWords: new Set(nameWordsList),
    catWords: new Set(catWordsList),
    descWords: new Set(descWordsList),
  };
  channelIndexCache.set(channel, indexed);
  return indexed;
}

function hasTermMatch(text: string, wordSet: Set<string>, term: string): boolean {
  if (term.length <= 4 && !term.includes(' ')) {
    return wordSet.has(term);
  }
  return text.includes(term);
}

function getStems(token: string): string[] {
  const stems = [token];
  if (token.endsWith('ies') && token.length > 4) {
    stems.push(token.slice(0, -3) + 'y');
  } else if (token.endsWith('es') && token.length > 4) {
    stems.push(token.slice(0, -2));
  } else if (token.endsWith('s') && token.length > 3) {
    stems.push(token.slice(0, -1));
  }
  if (token.endsWith('ing') && token.length > 6) {
    const base = token.slice(0, -3);
    stems.push(base);
    stems.push(base + 'e');
  } else if (token.endsWith('ing') && token.length === 6) {
    stems.push(token.slice(0, -3) + 'e');
  }
  return Array.from(new Set(stems));
}

function isEditDistanceOne(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (a === b) return true;

  if (la === lb) {
    let firstDiff = -1;
    for (let k = 0; k < la; k++) {
      if (a[k] !== b[k]) {
        firstDiff = k;
        break;
      }
    }
    if (
      firstDiff !== -1 &&
      firstDiff + 1 < la &&
      a[firstDiff] === b[firstDiff + 1] &&
      a[firstDiff + 1] === b[firstDiff] &&
      a.slice(firstDiff + 2) === b.slice(firstDiff + 2)
    ) {
      return true;
    }
  }

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else {
        i++;
        j++;
      }
    }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1;
}

function getExpandedTerms(phraseOrToken: string): string[] {
  const candidates = getStems(phraseOrToken);
  const related = new Set<string>();
  for (const cand of candidates) {
    const direct = TERM_TO_CLUSTER_TERMS.get(cand);
    if (direct) {
      for (const r of direct) related.add(r);
    }
  }
  if (phraseOrToken.length >= 5 && related.size === 0) {
    for (const [key, list] of TERM_TO_CLUSTER_TERMS.entries()) {
      if (isEditDistanceOne(phraseOrToken, key)) {
        related.add(key);
        for (const r of list) related.add(r);
      }
    }
  }
  return Array.from(related);
}

interface SearchScoreDetail {
  nameScore: number;
  descScore: number;
  catTopicScore: number;
  matchedAllNameTokens: boolean;
  matchedAllDirectTokens: boolean;
  matchedAllConcepts: boolean;
}

function evaluateChannelSearch(channel: TVChannel, q: string, tokens: string[]): SearchScoreDetail {
  const idx = getIndexedChannel(channel);
  let nameScore = 0;
  let descScore = 0;
  let catTopicScore = 0;

  // Ultra-short queries (1-2 chars): only match channel name
  if (q.length <= 2) {
    if (idx.nameLower === q) {
      nameScore += 350;
    } else if (idx.nameLower.includes(q)) {
      nameScore += 220;
      if (idx.nameLower.startsWith(q)) nameScore += 60;
    }
    return {
      nameScore,
      descScore: 0,
      catTopicScore: 0,
      matchedAllNameTokens: nameScore > 0,
      matchedAllDirectTokens: nameScore > 0,
      matchedAllConcepts: nameScore > 0,
    };
  }

  if (idx.nameLower === q) {
    nameScore += 350;
  } else if (idx.nameLower.includes(q)) {
    nameScore += 220;
    if (idx.nameLower.startsWith(q)) nameScore += 60;
  }
  if (idx.descLower.includes(q)) {
    descScore += 50;
  }
  if (idx.catLower.includes(q)) {
    catTopicScore += 60;
  }

  if (tokens.length === 0) {
    return {
      nameScore,
      descScore,
      catTopicScore,
      matchedAllNameTokens: nameScore > 0,
      matchedAllDirectTokens: nameScore > 0 || descScore > 0,
      matchedAllConcepts: nameScore > 0 || descScore > 0 || catTopicScore > 0,
    };
  }

  const phraseRelated = tokens.length > 1 ? getExpandedTerms(q) : [];
  if (phraseRelated.length > 0) {
    for (const rel of phraseRelated) {
      if (hasTermMatch(idx.nameLower, idx.nameWords, rel)) {
        catTopicScore += 36;
        break;
      }
      if (hasTermMatch(idx.catLower, idx.catWords, rel)) {
        catTopicScore += 30;
        break;
      }
    }
  }

  let matchedNameTokens = 0;
  let matchedDirectTokens = 0;
  let matchedConceptTokens = 0;

  for (const token of tokens) {
    const stems = getStems(token);
    let tokenName = 0;
    let tokenDesc = 0;
    let tokenCat = 0;

    for (const stem of stems) {
      if (hasTermMatch(idx.nameLower, idx.nameWords, stem)) {
        tokenName = Math.max(tokenName, 80);
      }
      if (hasTermMatch(idx.descLower, idx.descWords, stem)) {
        tokenDesc = Math.max(tokenDesc, 22);
      }
      if (hasTermMatch(idx.catLower, idx.catWords, stem)) {
        tokenCat = Math.max(tokenCat, 28);
      }
    }

    if (tokenName === 0 && token.length >= 5 && !TERM_TO_CLUSTER_TERMS.has(token)) {
      for (const word of idx.nameWords) {
        if (isEditDistanceOne(token, word)) {
          tokenName = Math.max(tokenName, 26);
          break;
        }
      }
    }

    if (tokenName > 0) {
      matchedNameTokens++;
      nameScore += tokenName;
    }
    if (tokenDesc > 0) {
      descScore += tokenDesc;
    }
    if (tokenCat > 0) {
      catTopicScore += tokenCat;
    }
    if (tokenName > 0 || tokenDesc > 0) {
      matchedDirectTokens++;
    }

    const relatedTerms = getExpandedTerms(token);
    let bestTopicScore = 0;
    if (relatedTerms.length > 0) {
      for (const rel of relatedTerms) {
        if (hasTermMatch(idx.nameLower, idx.nameWords, rel)) {
          bestTopicScore = Math.max(bestTopicScore, 26);
        } else if (hasTermMatch(idx.catLower, idx.catWords, rel)) {
          bestTopicScore = Math.max(bestTopicScore, 24);
        } else if (hasTermMatch(idx.descLower, idx.descWords, rel)) {
          bestTopicScore = Math.max(bestTopicScore, 14);
        }
        if (bestTopicScore >= 26) break;
      }
      catTopicScore += bestTopicScore;
    }

    if (tokenName > 0 || tokenDesc > 0 || tokenCat > 0 || bestTopicScore > 0) {
      matchedConceptTokens++;
    }
  }

  // Fallback substring check for partial multi-word fragments in name or description
  if (nameScore === 0 && q.length >= 3) {
    for (const t of tokens) {
      if (t.length >= 3 && idx.nameLower.includes(t)) {
        nameScore += 30;
      } else if (t.length >= 3 && idx.descLower.includes(t)) {
        descScore += 18;
      }
    }
  }

  const matchedAllNameTokens = tokens.length > 1 && matchedNameTokens === tokens.length;
  if (matchedAllNameTokens) {
    nameScore += 120;
  }
  const matchedAllDirectTokens = tokens.length > 1 && matchedDirectTokens === tokens.length;
  const matchedAllConcepts = tokens.length > 1 && matchedConceptTokens === tokens.length;

  return {
    nameScore,
    descScore,
    catTopicScore,
    matchedAllNameTokens,
    matchedAllDirectTokens,
    matchedAllConcepts,
  };
}

export function scoreChannelSearch(channel: TVChannel, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 1;

  const rawTokens = tokenizeWords(q);
  const meaningfulTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  const detail = evaluateChannelSearch(channel, q, tokens);
  return detail.nameScore * 10 + detail.descScore * 3 + detail.catTopicScore;
}

export function searchChannels(
  channels: TVChannel[],
  rawQuery: string,
  options?: {
    boostPredicate?: (channel: TVChannel) => boolean;
    tieBreaker?: (a: TVChannel, b: TVChannel) => number;
  }
): TVChannel[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return channels;

  const rawTokens = tokenizeWords(q);
  const meaningfulTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  const evaluated = channels.map((channel) => ({
    channel,
    ...evaluateChannelSearch(channel, q, tokens),
  }));

  const hasAllNameMatches = evaluated.some((item) => item.matchedAllNameTokens);
  const hasNameMatches = evaluated.some((item) => item.nameScore > 0);
  const hasAllDirectMatches = evaluated.some((item) => item.matchedAllDirectTokens);
  const hasDescMatches = evaluated.some((item) => item.descScore > 0);
  const hasAllConceptMatches = evaluated.some((item) => item.matchedAllConcepts);

  let filteredItems = evaluated;
  if (tokens.length > 1) {
    if (hasAllNameMatches) {
      filteredItems = evaluated.filter((item) => item.matchedAllNameTokens);
    } else if (hasAllDirectMatches) {
      filteredItems = evaluated.filter((item) => item.matchedAllDirectTokens);
    } else if (hasAllConceptMatches) {
      filteredItems = evaluated.filter((item) => item.matchedAllConcepts);
    } else if (hasNameMatches) {
      filteredItems = evaluated.filter((item) => item.nameScore > 0);
    } else if (hasDescMatches) {
      filteredItems = evaluated.filter((item) => item.descScore > 0);
    } else {
      filteredItems = evaluated.filter((item) => item.catTopicScore > 0);
    }
  } else {
    // Single-token or short specific search: strictly match specific channel names first;
    // never dump an entire category when channels with that name exist.
    if (hasNameMatches) {
      filteredItems = evaluated.filter((item) => item.nameScore > 0);
    } else if (hasDescMatches) {
      filteredItems = evaluated.filter((item) => item.descScore > 0);
    } else {
      filteredItems = evaluated.filter((item) => item.catTopicScore > 0);
    }
  }

  const scored = filteredItems.map((item) => {
    const baseScore = item.nameScore * 20 + item.descScore * 4 + item.catTopicScore;
    const conceptBonus = item.matchedAllConcepts ? 1000 : 0;
    const boost = options?.boostPredicate?.(item.channel) ? 60 : 0;
    return {
      channel: item.channel,
      score: conceptBonus + baseScore + boost,
    };
  });

  scored.sort((a, b) => b.score - a.score || (options?.tieBreaker ? options.tieBreaker(a.channel, b.channel) : 0));
  return scored.map((item) => item.channel);
}
