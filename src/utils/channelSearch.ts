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
    'family', 'nick', 'nickelodeon', 'disney', 'pbs', 'spongebob', 'dora', 'pokemon', 'looney',
    'sonic', 'transformers', 'yugioh', 'yu-gi-oh', 'manga', 'superhero', 'comics', 'baby', 'toddler'
  ],
  [
    'comedy', 'funny', 'humor', 'humour', 'laugh', 'laughs', 'joke', 'jokes', 'sitcom', 'sitcoms',
    'standup', 'stand-up', 'improv', 'parody', 'satire', 'prank', 'pranks', 'fail', 'fails',
    'afv', 'rifftrax', 'dry bar', 'snl', 'dark comedy', 'comedy drama'
  ],
  [
    'crime', 'true crime', 'mystery', 'mysteries', 'detective', 'forensic', 'forensics', 'murder',
    'homicide', 'police', 'cop', 'cops', 'court', 'judge', 'law', 'legal', 'investigation',
    'cold case', 'unsolved', 'prison', 'jail', 'fbi', 'csi', 'thriller', 'thrillers', '48 hours'
  ],
  [
    'horror', 'scary', 'spooky', 'creepy', 'terror', 'scream', 'ghost', 'ghosts', 'haunted',
    'paranormal', 'supernatural', 'monster', 'monsters', 'zombie', 'zombies', 'vampire', 'slasher',
    'halloween', 'ufo', 'ufos', 'alien', 'aliens', 'sci-fi', 'scifi', 'science fiction', 'fantasy'
  ],
  [
    'news', 'breaking', 'headlines', 'journalism', 'politics', 'political', 'government', 'election',
    'world', 'local', 'business', 'finance', 'financial', 'stocks', 'market', 'economy', 'money',
    'weather', 'storm', 'storms', 'forecast', 'climate', 'bloomberg', 'cnbc', 'cnn', 'bbc', 'fox',
    'nbc', 'cbs', 'abc', 'reuters', 'sky news', 'msnbc', 'c-span'
  ],
  [
    'sports', 'sport', 'athletics', 'football', 'nfl', 'soccer', 'fifa', 'mls', 'premier league',
    'basketball', 'nba', 'wnba', '3x3', 'baseball', 'mlb', 'hockey', 'nhl', 'golf', 'pga',
    'tennis', 'boxing', 'ufc', 'mma', 'fighting', 'combat', 'wrestling', 'wwe', 'tna', 'motorsport',
    'motorsports', 'racing', 'race', 'cars', 'car', 'nascar', 'f1', 'formula', 'auto', 'fishing',
    'hunting', 'outdoors', 'billiards', 'bowling', 'olympics', 'action sports', 'stadium'
  ],
  [
    'movie', 'movies', 'film', 'films', 'cinema', 'blockbuster', 'theater', 'theatre', 'action',
    'adventure', 'western', 'westerns', 'cowboy', 'romance', 'romantic', 'romcom', 'love',
    'drama', 'classic', 'classics', 'indie', 'filmrise', 'hallmark', 'miramax', 'thriller'
  ],
  [
    'food', 'cooking', 'cook', 'chef', 'chefs', 'kitchen', 'recipe', 'recipes', 'baking', 'bake',
    'restaurant', 'culinary', 'tastemade', 'travel', 'home', 'house', 'garden', 'diy', 'renovation',
    'design', 'interior', 'fashion', 'style', 'beauty', 'lifestyle', 'pop culture', 'shopping', 'qvc', 'auction'
  ],
  [
    'nature', 'wildlife', 'animals', 'animal', 'pet', 'pets', 'dog', 'dogs', 'puppy', 'puppies',
    'cat', 'cats', 'kitten', 'ocean', 'sea', 'earth', 'planet', 'environment', 'science', 'space',
    'nasa', 'astronomy', 'history', 'historical', 'biography', 'documentary', 'documentaries', 'doc',
    'docs', 'educational', 'education', 'learning', 'wild'
  ],
  [
    'music', 'song', 'songs', 'hits', 'pop', 'rock', 'hip-hop', 'hiphop', 'rap', 'country', 'jazz',
    'r&b', 'electronic', 'dance', 'edm', '80s', '90s', '2000s', 'throwback', 'mtv', 'vevo',
    'karaoke', 'concert', 'concerts', 'radio', 'ambient', 'ambiance', 'chill', 'lofi', 'relax',
    'relaxing', 'fireplace', 'sleep'
  ],
  [
    'gaming', 'game', 'games', 'esports', 'gamer', 'gamers', 'videogames', 'video games', 'tech',
    'technology', 'computer', 'computers', 'geek', 'nerd', 'retro'
  ],
  [
    'reality', 'reality tv', 'dating', 'competition', 'contest', 'game show', 'game shows', 'trivia',
    'quiz', 'talk', 'talk show', 'celebrity', 'gossip', 'entertainment', 'series', 'tv'
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

function getIndexedChannel(channel: TVChannel): IndexedChannel {
  const cached = channelIndexCache.get(channel);
  if (cached) return cached;

  const meta = classifyChannel(channel);
  const nameLower = channel.name.toLowerCase();
  const catLower = `${meta.category} ${meta.subType} ${channel.category}`.toLowerCase();
  const descLower = `${channel.description || ''} ${meta.network}`.toLowerCase();
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

  // Adjacent transposition check (e.g. "comdey" <-> "comedy")
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
  if (phraseOrToken.length >= 4 && related.size === 0) {
    for (const [key, list] of TERM_TO_CLUSTER_TERMS.entries()) {
      if (key.startsWith(phraseOrToken) || isEditDistanceOne(phraseOrToken, key)) {
        related.add(key);
        for (const r of list) related.add(r);
      }
    }
  }
  return Array.from(related);
}

export function scoreChannelSearch(channel: TVChannel, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 1;

  const idx = getIndexedChannel(channel);
  let score = 0;

  if (idx.nameLower === q) {
    score += 350;
  } else if (idx.nameLower.includes(q)) {
    score += 220;
    if (idx.nameLower.startsWith(q)) score += 60;
  }
  if (idx.catLower.includes(q)) {
    score += 90;
  }
  if (idx.descLower.includes(q)) {
    score += 50;
  }

  const rawTokens = tokenizeWords(q);
  const meaningfulTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  if (tokens.length === 0) {
    return score;
  }

  const phraseRelated = tokens.length > 1 ? getExpandedTerms(q) : [];
  if (phraseRelated.length > 0) {
    for (const rel of phraseRelated) {
      if (hasTermMatch(idx.nameLower, idx.nameWords, rel)) {
        score += 36;
        break;
      }
      if (hasTermMatch(idx.catLower, idx.catWords, rel)) {
        score += 30;
        break;
      }
    }
  }

  let matchedTokenCount = 0;

  for (const token of tokens) {
    const stems = getStems(token);
    let tokenScore = 0;

    for (const stem of stems) {
      if (hasTermMatch(idx.nameLower, idx.nameWords, stem)) {
        tokenScore = Math.max(tokenScore, 40);
      } else if (hasTermMatch(idx.catLower, idx.catWords, stem)) {
        tokenScore = Math.max(tokenScore, 30);
      } else if (hasTermMatch(idx.descLower, idx.descWords, stem)) {
        tokenScore = Math.max(tokenScore, 18);
      }
    }

    if (tokenScore === 0 && token.length >= 4) {
      for (const word of idx.words) {
        if (isEditDistanceOne(token, word)) {
          tokenScore = Math.max(tokenScore, 22);
          break;
        }
      }
    }

    const relatedTerms = getExpandedTerms(token);
    if (relatedTerms.length > 0) {
      let bestTopicScore = 0;
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
      tokenScore = Math.max(tokenScore, bestTopicScore);
    }

    if (tokenScore > 0) {
      matchedTokenCount++;
      score += tokenScore;
    }
  }

  if (tokens.length > 1 && matchedTokenCount === tokens.length) {
    score += 40;
  }

  if (score === 0) {
    for (const t of tokens) {
      if (t.length >= 2 && idx.fullText.includes(t)) {
        score += 25;
      }
    }
  }

  return score;
}
