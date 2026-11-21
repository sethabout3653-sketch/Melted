import { EsrbRatingCode, GameCategory, GameRatingInfo } from '../types/game';

const RATINGS: Record<EsrbRatingCode, { code: EsrbRatingCode; label: string; age: string }> = {
  E: {
    code: 'E',
    label: 'Everyone',
    age: 'ALL',
  },
  'E10+': {
    code: 'E10+',
    label: 'Everyone 10+',
    age: '10+',
  },
  T: {
    code: 'T',
    label: 'Teen',
    age: '13+',
  },
  M: {
    code: 'M',
    label: 'Mature 17+',
    age: '17+',
  },
  AO: {
    code: 'AO',
    label: 'Adults Only 18+',
    age: '18+',
  },
};

interface RatingExtras {
  descriptors?: string;
  requiresGate?: boolean;
  gateMinAge?: '13+' | '17+' | '18+';
  specialTags?: string[];
  coverTag?: string;
  warningMessage?: string;
}

function makeRating(code: EsrbRatingCode, extras: RatingExtras = {}): GameRatingInfo {
  const defaultGate = code === 'M' || code === 'AO';
  const gateMinAge: '13+' | '17+' | '18+' | undefined =
    extras.gateMinAge ||
    (code === 'AO' ? '18+' : code === 'M' ? '17+' : extras.requiresGate ? '13+' : undefined);

  const defaultTags: string[] =
    code === 'AO'
      ? ['18+ Adults Only', 'Mature Content']
      : code === 'M'
      ? ['17+ Mature', 'Mature Content']
      : code === 'T'
      ? extras.requiresGate
        ? ['13+ Teen', 'Teen Advisory']
        : ['13+ Teen']
      : code === 'E10+'
      ? ['10+ Rated', 'Mild Action']
      : ['All Ages', 'Family Friendly'];

  return {
    ...RATINGS[code],
    descriptors: extras.descriptors,
    requiresGate: extras.requiresGate ?? defaultGate,
    gateMinAge,
    specialTags: extras.specialTags && extras.specialTags.length > 0 ? extras.specialTags : defaultTags,
    coverTag: extras.coverTag,
    warningMessage: extras.warningMessage,
  };
}

interface RatingRule {
  pattern: RegExp;
  code: EsrbRatingCode;
  extras?: RatingExtras;
}

/**
 * Curated ESRB & content rating rules ordered from most specific exceptions
 * down to verified franchises and content-aware heuristics.
 *
 * Soundboards, utility apps, and mild/nice games ("not that bad") do NOT
 * trigger the interactive age/content gate.
 */
const SPECIFIC_RATING_RULES: RatingRule[] = [
  // --------------------------------------------------------------------------
  // 1. Utility / Soundboard / Nice Games (NEVER trigger content gate)
  // --------------------------------------------------------------------------
  {
    pattern: /\b(soundboard|gemini)\b/i,
    code: 'E',
    extras: {
      descriptors: 'Interactive Audio & Web Content',
      requiresGate: false,
      specialTags: ['All Ages', 'Soundboard / App'],
    },
  },
  {
    pattern: /\b(bubble shooter|zuma shooter|apple shooter|super puzzle fighter|nickelodeon super brawl)\b/i,
    code: 'E',
    extras: {
      descriptors: 'Mild Cartoon Action',
      requiresGate: false,
      specialTags: ['All Ages', 'Arcade'],
    },
  },
  {
    pattern: /\b(fnaf\s*world|five nights at freddy'?s:?\s*world)\b/i,
    code: 'E10+',
    extras: {
      descriptors: 'Fantasy Violence',
      requiresGate: false,
      specialTags: ['10+ Rated', 'RPG Adventure'],
    },
  },
  {
    pattern: /\brevelations:\s*persona\b|\bpersona\s*1\b/i,
    code: 'E',
    extras: {
      descriptors: 'Fantasy Violence, Mild Language',
      requiresGate: false,
      specialTags: ['All Ages', 'Classic RPG'],
    },
  },

  // --------------------------------------------------------------------------
  // 2. Specific Psychological / Creepypasta / 18+ Adults Only Titles (AO 18+ Gated)
  // --------------------------------------------------------------------------
  {
    pattern: /\b(doki doki literature club|ddlc)\b/i,
    code: 'T',
    extras: {
      descriptors: 'Blood, Psychological Horror, Disturbing Content, Self-Harm Themes',
      requiresGate: true,
      gateMinAge: '13+',
      specialTags: ['13+ Teen', 'Psychological Horror', 'Disturbing Content', 'Self-Harm Themes'],
      coverTag: '13+ Horror',
      warningMessage:
        'This game is not suitable for children or those who are easily disturbed. It contains intense psychological horror, themes of depression and self-harm, and unsettling imagery. Ages 13+.',
    },
  },
  {
    pattern: /\b(omori|milk (inside|outside) a bag of milk|miside|endoparasitic)\b/i,
    code: 'AO',
    extras: {
      descriptors: 'Psychological Horror, Blood, Strong Language, Disturbing Themes',
      requiresGate: true,
      gateMinAge: '18+',
      specialTags: ['18+ Adults Only', 'Psychological Horror', 'Disturbing Themes'],
      coverTag: '18+ Horror',
      warningMessage:
        'Contains dark psychological themes, unsettling horror imagery, and mature subject matter recommended for players 18+.',
    },
  },
  {
    pattern: /\b(sonic\.exe|hypno'?s?\s*lullaby|wednesday'?s?\s*infidelity|sunday\s*night\s*suicide|mario'?s?\s*madness|creepypasta|squidward'?s sizzlin'? scare)\b/i,
    code: 'AO',
    extras: {
      descriptors: 'Blood, Horror, Disturbing Themes, Flashing Imagery',
      requiresGate: true,
      gateMinAge: '18+',
      specialTags: ['18+ Adults Only', 'Creepypasta Horror', 'Blood & Gore', 'Flashing Imagery'],
      coverTag: '18+ Horror',
      warningMessage:
        'Contains creepypasta horror themes, disturbing visuals, blood, and flashing imagery.',
    },
  },

  // --------------------------------------------------------------------------
  // 3. Verified Mature (M 17+ Gated) Titles & Franchises
  // --------------------------------------------------------------------------
  {
    pattern: /\b(resident evil|silent hill|outlast|fear to fathom|fears to fathom|manhunt|cry of fear|dead tapes|christmas massacre)\b/i,
    code: 'M',
    extras: {
      descriptors: 'Blood and Gore, Intense Violence, Horror',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Survival Horror', 'Blood & Gore'],
      coverTag: '17+ Horror',
      warningMessage:
        'Survival horror title featuring blood, gore, jump scares, and intense violent imagery.',
    },
  },
  {
    pattern: /\b(doom|2doom|zdoom|ultrakill|quake|half[\s-]*life|opposing force|nazi zombies|\bnzp\b|wolfenstein|duke nukem)\b/i,
    code: 'M',
    extras: {
      descriptors: 'Blood and Gore, Intense Violence',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Blood & Gore', 'Intense Shooter'],
      coverTag: '17+ Gore',
      warningMessage:
        'Fast-paced shooter containing graphic blood, gore, and intense combat violence.',
    },
  },
  {
    pattern: /\b(grand theft auto|\bgta\b|gta\s*[1-5iv]+|vice city|san andreas|chinatown wars|saints row|postal|hotline miami|max payne|hitman|payday)\b/i,
    code: 'M',
    extras: {
      descriptors: 'Intense Violence, Blood, Strong Language, Mature Themes',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Crime & Violence', 'Strong Language'],
      coverTag: '17+ Mature',
      warningMessage:
        'Contains intense violence, crime themes, blood, and strong language intended for mature audiences.',
    },
  },
  {
    pattern: /\b(call of duty|modern warfare|black ops|rainbow six|counter[\s-]*strike)\b/i,
    code: 'M',
    extras: {
      descriptors: 'Blood and Gore, Intense Violence, Strong Language',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Military Shooter', 'Blood & Language'],
      coverTag: '17+ Mature',
      warningMessage:
        'Tactical military shooter featuring intense gunfire, blood, and strong language.',
    },
  },
  {
    pattern: /\b(binding of isaac|binding of issac|wrath of the lamb|fallout|elder scrolls|daggerfall|morrowind|oblivion|skyrim|diablo|borderlands|bioshock|far cry)\b/i,
    code: 'M',
    extras: {
      descriptors: 'Blood and Gore, Violence, Dark Themes',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Blood & Gore', 'Dark Fantasy'],
      coverTag: '17+ Mature',
      warningMessage:
        'Contains blood and gore, dark themes, and mature fantasy/sci-fi violence.',
    },
  },
  {
    pattern: /\b(mortal kombat|god of war|devil may cry|metal gear solid|madness combat|blood tournament|bloodmoney|happy wheels|short life)\b/i,
    code: 'M',
    extras: {
      descriptors: 'Blood and Gore, Intense Violence',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Blood & Gore', 'Graphic Violence'],
      coverTag: '17+ Gore',
      warningMessage:
        'Features explicit cartoon/graphic blood, gore, and intense combat.',
    },
  },
  {
    pattern: /\b(danganronpa|class of '?09|kindergarten|helltaker|persona\s*[2-5])\b/i,
    code: 'M',
    extras: {
      descriptors: 'Blood, Strong Language, Mature & Suggestive Themes',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Strong Language', 'Mature Themes'],
      coverTag: '17+ Mature',
      warningMessage:
        'Contains mature dialogue, strong language, dark humor, and violent/suggestive themes.',
    },
  },

  // --------------------------------------------------------------------------
  // 4. Teen (T 13+) GATED Horror / Intense / Mature-Lite Titles
  // --------------------------------------------------------------------------
  {
    pattern: /\b(five nights at freddy'?s|fnaf|a bite at freddy'?s|one night as freddy'?s)\b/i,
    code: 'T',
    extras: {
      descriptors: 'Blood, Fantasy Violence, Jump Scares',
      requiresGate: true,
      gateMinAge: '13+',
      specialTags: ['13+ Teen', 'Jump Scares', 'Horror & Suspense', 'Dark Lore'],
      coverTag: '13+ Horror',
      warningMessage:
        'Contains loud jump scares, eerie horror tension, and dark thematic lore. Recommended for ages 13+.',
    },
  },
  {
    pattern: /\b(granny|bendy|poppy playtime|slender|backrooms|man from the window|that'?s not my neighbou?r|scary shawarma|tattletail|yume nikki|end roll|\boffgame\b|tung sahur horror|arthur'?s nightmare|boxhead nightmare)\b/i,
    code: 'T',
    extras: {
      descriptors: 'Horror Themes, Jump Scares, Violence',
      requiresGate: true,
      gateMinAge: '13+',
      specialTags: ['13+ Teen', 'Horror & Scares', 'Suspense'],
      coverTag: '13+ Horror',
      warningMessage:
        'Contains horror themes, unsettling encounters, and jump scares. Recommended for ages 13+.',
    },
  },
  {
    pattern: /\b(deltarune|deltatraveler)\b/i,
    code: 'T',
    extras: {
      descriptors: 'Fantasy Violence, Mild Blood, Mild Language',
      requiresGate: true,
      gateMinAge: '13+',
      specialTags: ['13+ Teen', 'Fantasy Violence', 'Mild Language'],
      coverTag: '13+ Teen',
      warningMessage:
        'Rated Teen (13+) for fantasy violence, mild blood, and mild language.',
    },
  },
  {
    pattern: /\b(friday night funkin|\bfnf\b)\b/i,
    code: 'T',
    extras: {
      descriptors: 'Suggestive Themes, Cartoon Violence, Mild Language',
      requiresGate: true,
      gateMinAge: '13+',
      specialTags: ['13+ Teen', 'Suggestive Themes', 'Rhythm Action'],
      coverTag: '13+ Teen',
      warningMessage:
        'Rated Teen (13+) for suggestive themes, mature lyrics/humor, and stylized cartoon violence.',
    },
  },
  {
    pattern: /\b(superhot|bullet force|500 caliber|kour\.io|halo:\s*combat|ace gangster|gangster bros|stealth assassin|ultimate assassin|sniper shot|sniper v2|effing zombies|sas:\s*zombie|hobo vs zombies|zombie exploder|zombie road)\b/i,
    code: 'T',
    extras: {
      descriptors: 'Violence, Shooter Action',
      requiresGate: true,
      gateMinAge: '13+',
      specialTags: ['13+ Teen', 'Shooter & Combat', 'Violence'],
      coverTag: '13+ Action',
      warningMessage:
        'Contains shooter combat and stylized violence. Recommended for ages 13+.',
    },
  },

  // --------------------------------------------------------------------------
  // 5. Teen (T 13+) NICE / MILD Games (NO content gate!)
  // --------------------------------------------------------------------------
  {
    pattern: /\b(bowmasters|baldur'?s gate|tony hawk|street fighter|tekken|jojo'?s bizarre adventure|touhou|terraria|super meat boy|bitlife|1v1\.lol|time shooter|rooftop snipers|getaway shootout|johnny trigger|ragdoll hit|stick war|evowars|gunspin|blockpost|fortzone|brawl guys|pixel gun survival|build a big army|camouflage and sniper|gun clone|gun runner|office fight|stickman fight|ace combat|jet force gemini|killer instinct|nickelodeon|one piece|mario combat|ninja brawl|praxis fighter|warfare 1944|zombies ate my neighbors|gun mayhem|gun knight|gun night|gun\.smoke|iron soldier|block craft shooter|funny shooter|pixel combat|pixel shooter|brawl simulator|stickman and guns|generic fighter)\b/i,
    code: 'T',
    extras: {
      descriptors: 'Cartoon & Fantasy Violence',
      requiresGate: false,
      specialTags: ['13+ Teen', 'Arcade Action'],
      coverTag: '13+ Teen',
    },
  },

  // --------------------------------------------------------------------------
  // 6. Everyone 10+ (E10+) Titles & Series (NO content gate)
  // --------------------------------------------------------------------------
  {
    pattern: /\b(undertale|academytale|bad time simulator)\b/i,
    code: 'E10+',
    extras: {
      descriptors: 'Fantasy Violence, Mild Blood, Mild Language',
      requiresGate: false,
      specialTags: ['10+ Rated', 'Story RPG'],
    },
  },
  {
    pattern: /\b(minecraft|hollow knight|celeste|cuphead|plants vs\.?\s*zombies|\bpvz\b|balatro|hello neighbor|baldi'?s)\b/i,
    code: 'E10+',
    extras: {
      descriptors: 'Fantasy Violence',
      requiresGate: false,
      specialTags: ['10+ Rated', 'Adventure'],
    },
  },
  {
    pattern: /\b(ocarina of time|shadow the hedgehog|lego batman|brotato|antonblast|pizza tower|henry stickmin|escaping the prison|fleeing the complex|stealing the diamond|infiltrating the airship|breaking the bank)\b/i,
    code: 'E10+',
    extras: {
      descriptors: 'Cartoon & Fantasy Violence',
      requiresGate: false,
    },
  },
  {
    pattern: /\b(vex\s*[1-8x]|vex challenges|age of war|raft wars|sprunki|cat gunner|swordfight|tomb of the mask|toss the turtle|burrito bison|gladihoppers|supreme duelist|bazooka boy)\b/i,
    code: 'E10+',
    extras: {
      descriptors: 'Mild Cartoon Violence',
      requiresGate: false,
    },
  },
  {
    pattern: /\b(super smash bros|castlevania|metroid|fire emblem|advance wars|brawl stars|tabs|totally accurate battle)\b/i,
    code: 'E10+',
    extras: {
      descriptors: 'Fantasy Violence',
      requiresGate: false,
    },
  },

  // --------------------------------------------------------------------------
  // 7. Everyone (E) Titles & Series (NO content gate)
  // --------------------------------------------------------------------------
  {
    pattern: /\b(super mario|mario kart|paper mario|mario bros|cat mario|jelly mario|legend of zelda|majora'?s mask|link'?s awakening|oracle of seasons|minish cap|phantom hourglass|spirit tracks|pokemon|pok[eé]mon)\b/i,
    code: 'E',
    extras: {
      descriptors: 'Mild Fantasy Violence',
      requiresGate: false,
    },
  },
  {
    pattern: /\b(sonic|animal crossing|oneshot|kirby|warioware|crash bandicoot|bomberman|little ?big ?planet|angry birds|cut the rope|fireboy and watergirl|duck life)\b/i,
    code: 'E',
    extras: {
      descriptors: 'Mild Cartoon Violence',
      requiresGate: false,
    },
  },
  {
    pattern: /\b(retro bowl|slope|geometry dash|crossy road|subway surfers|temple run|jetpack joyride|cookie clicker|little alchemy|bloons|btd\s*[1-5]|ovo|drive mad|moto x3m|drift hunters|8 ball pool|basketball|soccer|bowling|tiny fishing|pou|2048|wordle|chess|solitaire|uno|crossword|tetris|pac[\s-]*man|asteroids|google dino|ice dodo|block blast|paper\.io|line rider|world'?s hardest game|this is the only level|coreball|cubefield|tiny square|cluster rush|adventure capitalist|gobble|amaze|dig deep|monster tracks|snow rider)\b/i,
    code: 'E',
    extras: {
      requiresGate: false,
    },
  },
];

/**
 * Resolves an ESRB content rating, special tags, and age-gate eligibility
 * for every game in the catalog.
 */
export function resolveGameRating(
  name: string,
  special?: string[],
  category?: GameCategory
): GameRatingInfo {
  const cleanName = (name || '').trim();
  const combined = `${cleanName} ${(special || []).join(' ')}`.trim();

  for (const rule of SPECIFIC_RATING_RULES) {
    if (rule.pattern.test(combined)) {
      return makeRating(rule.code, rule.extras);
    }
  }

  // Fallback heuristics for remaining browser/flash/arcade games
  if (
    /\b(gore|blood|murder|massacre|torture|demon|satan|hell|corpse|slaughter|zombie apocalypse|kill yourself|suicide|slenderman|jeff the killer)\b/i.test(
      combined
    )
  ) {
    return makeRating('M', {
      descriptors: 'Blood, Horror, Violence',
      requiresGate: true,
      gateMinAge: '17+',
      specialTags: ['17+ Mature', 'Horror & Gore'],
      coverTag: '17+ Horror',
      warningMessage:
        'Contains mature horror, blood, or violent themes intended for players 17+.',
    });
  }

  // Horror/scary fallback games -> 13+ T WITH gate
  if (
    /\b(horror|scary|nightmare|terror|fright|creepy|haunted|asylum|creepypasta)\b/i.test(combined) ||
    category === 'Horror & Mystery'
  ) {
    return makeRating('T', {
      descriptors: 'Horror Themes, Suspense',
      requiresGate: true,
      gateMinAge: '13+',
      specialTags: ['13+ Teen', 'Horror & Mystery'],
      coverTag: '13+ Horror',
      warningMessage:
        'Contains horror and suspense elements. Recommended for ages 13+.',
    });
  }

  // Action/shooter/fighting games -> T without aggressive gate unless explicitly severe
  if (
    /\b(shoot|shooter|sniper|gun|guns|rifle|pistol|shotgun|combat|assassin|warfare|army|military|swat|soldier|zombie|zombies|fight|fighter|fighting|brawl|mafia|gangster|crime|prison|jail|kill|killer|death|skull)\b/i.test(
      combined
    )
  ) {
    return makeRating('T', {
      descriptors: 'Arcade Violence',
      requiresGate: false,
      specialTags: ['13+ Teen', 'Action'],
      coverTag: '13+ Teen',
    });
  }

  if (
    /\b(war|battle|tank|laser|rocket|bomb|sword|knight|dungeon|dragon|monster|alien|robot|ninja|pirate|viking|hero|stickman|ragdoll|arena|defend|defense|tower defense|action|smash|clash|hunt)\b/i.test(
      combined
    ) ||
    category === 'Action & Shooters'
  ) {
    return makeRating('E10+', {
      descriptors: 'Fantasy & Cartoon Violence',
      requiresGate: false,
    });
  }

  return makeRating('E', { requiresGate: false });
}
