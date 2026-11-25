import rawGamesData from '../data/gnMathGames.json';
import rawUgsData from '../data/ugsGames.json';
import rawCkvData from '../data/ckvGames.json';
import luminBuiltinData from '../data/luminBuiltinGames.json';
import { RawGame, GameItem, GameCategory, GameLibraryId } from '../types/game';
import { resolveGameRating } from './gameRatingService';

import fileMapData from '../data/gnMathFileMap.json';

const fileMap = fileMapData as Record<string, string>;

const VALID_GAME_CATEGORIES = new Set<GameCategory>([
  'Action & Shooters',
  'Driving & Racing',
  'Skill & Platformer',
  'Retro & Arcade',
  'Horror & Mystery',
  'Sports & Physics',
  'Puzzle & Casual',
  'Emulators & Ports',
]);

const LUMIN_CATEGORY_MAP = new Map<string, GameCategory>();
for (const entry of luminBuiltinData as Array<{ name?: string; category?: string }>) {
  if (entry?.name && entry?.category && VALID_GAME_CATEGORIES.has(entry.category as GameCategory)) {
    const norm = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm && !LUMIN_CATEGORY_MAP.has(norm)) {
      LUMIN_CATEGORY_MAP.set(norm, entry.category as GameCategory);
    }
  }
}

export const UGS_INDEX_URL = 'https://cdn.jsdelivr.net/gh/gmshelf/ugs@main/ugs.json';
export const UGS_BASE_URL = 'https://cdn.jsdelivr.net/gh/gmshelf/ugs@main';

// ============================================================================
// 1. GAME COVERS RESOLUTION SYSTEM (IMAGES ONLY)
// ============================================================================
export const COVER_BASE = '/api/cover';
export const COVER_PRIMARY_BASE = '/api/cover';
export const FALLBACK_COVER_BASE = 'https://raw.githubusercontent.com/gn-math/covers/main';
export const COVER_PROXY_BASE = '/api/cover';

export function resolveCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  if (rawCover.startsWith('http://') || rawCover.startsWith('https://')) {
    if (rawCover.includes('covers@main') || rawCover.includes('/covers/')) {
      const filename = rawCover.split('/').pop() || '';
      return `${COVER_PRIMARY_BASE}/${filename}`;
    }
    return rawCover;
  }
  const clean = rawCover.replace('{COVER_URL}/', '').replace('{COVER_URL}', '').trim();
  return `${COVER_PRIMARY_BASE}/${clean}`;
}

export function getDirectCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  if (rawCover.startsWith('http://') || rawCover.startsWith('https://')) {
    const filename = rawCover.split('/').pop() || '';
    return `${FALLBACK_COVER_BASE}/${filename}`;
  }
  const clean = rawCover.replace('{COVER_URL}/', '').replace('{COVER_URL}', '').trim();
  return `${FALLBACK_COVER_BASE}/${clean}`;
}

export function getProxyCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  const clean = rawCover.replace('{COVER_URL}/', '').replace('{COVER_URL}', '').trim();
  const filename = clean.startsWith('http') ? clean.split('/').pop() || '' : clean;
  return `${COVER_PROXY_BASE}/${filename}`;
}

// ============================================================================
// 2. GAME PLAYABLE URL RESOLUTION SYSTEM (HTML & IFRAME GAME STREAMS ONLY)
// ============================================================================
export const RAWGITHACK_BASE = 'https://raw.githack.com/gn-math/html/main';
export const GAME_PROXY_BASE = '/api/raw';

/**
 * Resolves the canonical streaming URL for a game payload.
 * Strictly decoupled from image covers.
 */
export function resolveGameUrl(rawUrl: string, gameId?: number): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const clean = rawUrl.replace('{HTML_URL}/', '').replace('{HTML_URL}', '').trim();
  const numPrefix = clean.match(/^\d+/)?.[0];

  // 5-step fallback hierarchy against gnMathFileMap
  const mapped =
    fileMap[clean] ||
    fileMap[clean.replace(/\.html$/, '')] ||
    (gameId !== undefined && gameId !== null ? fileMap[String(gameId)] : null) ||
    (numPrefix ? fileMap[numPrefix] : null);

  const targetFile = mapped || (clean.includes('.') ? clean : `${clean}.html`);
  return `${RAWGITHACK_BASE}/${targetFile}`;
}

/**
 * Provides a local backend streaming proxy URL for the game payload,
 * ensuring seamless gameplay even if upstream CDN or school firewalls block rawgithack.
 */
export function getProxyGameUrl(rawUrl: string, gameId?: number): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const clean = rawUrl.replace('{HTML_URL}/', '').replace('{HTML_URL}', '').trim();
  const numPrefix = clean.match(/^\d+/)?.[0];

  const mapped =
    fileMap[clean] ||
    fileMap[clean.replace(/\.html$/, '')] ||
    (gameId !== undefined && gameId !== null ? fileMap[String(gameId)] : null) ||
    (numPrefix ? fileMap[numPrefix] : null);

  const targetFile = mapped || (clean.includes('.') ? clean : `${clean}.html`);
  return `${GAME_PROXY_BASE}/${targetFile}`;
}

export function getDirectRawGitHackUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  return rawUrl.replace('{HTML_URL}', RAWGITHACK_BASE);
}

const FEATURED_NAMES = new Set([
  'Drive Mad',
  'OvO',
  'OvO 2',
  'Bowmasters',
  "Five Nights at Freddy's",
  'Friday Night Funkin',
  'Jetpack Joyride',
  'Gladihoppers',
  'Retro Bowl',
  'Slope',
  '1v1.lol',
  'Subway Surfers',
  'Cookie Clicker',
  'Moto X3M',
  'Crossy Road',
  'Bitlife',
  'Superhot',
  'Basketball Stars',
  'Bad Time Simulator (Sans Fight)',
  'Smash Karts',
  'Duck Life 4',
  'Undertale',
  'Deltarune',
  'Vex 7',
  'Geometry Dash',
  'FNAF 2',
]);

export function detectCategory(game: RawGame): GameCategory {
  if (game.category && VALID_GAME_CATEGORIES.has(game.category)) {
    return game.category;
  }

  const rawName = (game.name || '').trim();
  const name = rawName.toLowerCase();
  const compact = name.replace(/[^a-z0-9]/g, '');

  const luminCat = LUMIN_CATEGORY_MAP.get(compact);
  if (luminCat) {
    return luminCat;
  }

  const special = (game.special || []).map((s) => s.toLowerCase());

  // 1. Explicit Emulator / Console / Port tags
  if (
    special.some((s) =>
      ['n64', 'gba', 'nds', 'nes', 'snes', 'psx', 'ps1', 'dos', 'emulator', 'port'].includes(s)
    )
  ) {
    return 'Emulators & Ports';
  }

  // 2. Rhythm & FNF -> Retro & Arcade (checked early so FNF mods don't match unrelated substrings)
  if (
    special.includes('fnf') ||
    name.includes('friday night funkin') ||
    /\bfnf/.test(name) ||
    compact.startsWith('fnf') ||
    name.includes('sprunki') ||
    name.includes('sprunked') ||
    /\bosu\b/.test(name) ||
    name.includes('dance of fire and ice') ||
    name.includes('magic tiles') ||
    name.includes('rhythm heaven') ||
    name.includes('parappa') ||
    name.includes('taiko no tatsujin') ||
    name.includes('bolly beat') ||
    name.includes('pico night funkin') ||
    name.includes('hit single real')
  ) {
    return 'Retro & Arcade';
  }

  // 3. Horror & Mystery
  if (
    /(fnaf|freddy|granny|horror|slender|bendy|backrooms|baldi|zombie|zombopaclypse|zombotron|siren head|huggy|poppy|banban|phasmophobia|phasmaphobia|amnesia|outlast|silent hill|resident evil|bio evil|doki doki|ddlc|yume nikki|yumenikki|omori|endoparasitic|fearstofathom|fears to fathom|hungry lamu|tattletail|miside|milk inside|milkinside|milk outside|milkoutside|dead estate|dead zed|last stand|boxhead|deep sleep|deeper sleep|deepest sleep|don't escape|dont escape|haunt|nightmare|creepy|spooky|shrek's hotel|shreks hotel|my neighbor|my neighbour|man from the window|dark deception|bad parenting|buckshot roulette|dementium|dead tapes|99 nights in the forest|endroll|endacopia|serial experiments|helltaker|road of the dead|thermomorph|make sure it's closed|lock the door|ancient sins|dying dreams|slide in the woods|five nights|bite at|among us|barry has a secret|abandoned|god's flesh|station 141|station saturn|dimension incident|scary shawarma|weresquirrel|sizzlin' scare|cellar door|arcanum|fear assessment|\bscp\b|\bghost\b|\bdevil\b|\bdemon\b|\bcursed\b|\bundead\b|\bterror\b|\bscream\b|\binsanity\b|\basylum\b|\bvampire\b|\bblood\b|\bfear\b|\bmimic\b|\boffgame\b|\bvena\b)/i.test(
      name
    ) ||
    compact === 'off' ||
    compact === 'offgame'
  ) {
    return 'Horror & Mystery';
  }

  // 4. Driving & Racing
  if (
    !name.includes('wheely') &&
    (/(moto|motor|drift|racing|racer|kart|parking|snow rider|snowroad|snow road|slowroads|slow roads|poly track|polytrack|excitebike|tanuki sunset|escap[ea] road|underwheels|monster tracks|survival race|bridge race|hula hoop race|aquapark|rigbmx|bitplanes|scrap metal|driven wild|aviamasters|f-zero|wipeout|gran turismo|need for speed|mountain|downhill|hill climb|rocket league|highway traffic|traffic jam|traffic rider|sky riders|toy rider|free rider|snowboard|bergentruck)/i.test(
      name
    ) ||
      /\b(drive|driver|driving|car|cars|race|rally|taxi|truck|trucks|bike|bikes|bmx|nfs|turbo|speed|flight|plane|planes|superboat|boat|enduro|burnout|coaster|rider|riders|swerve|vapor trails)\b/i.test(
        name
      ))
  ) {
    return 'Driving & Racing';
  }

  // 5. Sports & Physics
  if (
    /(basketball|basket|soccer|football|tennis|golf|hockey|physics|baseball|volleyball|volley|bowling|boxing|wrestl|karate|archery|gladiator|gladihoppers|ragdoll|angry birds|bad piggies|bouncemasters|flip master|bottle flip|fifa|madden|nfl|nba|nhl|mlb|world cup|punch-out|punch out|tony hawk|skater|shredsauce|shred mill|unicycle|kickball|get on top|house of hazards|happy wheels|short life|get yoked|mutilate|interactive buddy|elastic|toss the turtle|kitten cannon|burrito bison|learn to fly|learn to die|fork n sausage|99 balls|going balls|coreball|core ball|12 minibattles|12 mini battles|fc 25|mini battles|oshi oshi|blade ball|curve ball|toasterball|tube jumpers|waterpool|stack ball|two ball|crunchball|roller baller|rockerpult|rocketpult|bart bash|pokey ball|silo showdown|return man|penalty kicks|triple play|side pocket|hajime no ippo|btts|bntts|push your luck|wavedash|knife hit|fluidism|gravity mod|handulum|bottle cracks|civiballs|crazy cattle|gimme the airpod|ice age baby)/i.test(
      name
    ) ||
    /\b(bowl|pool|8 ball|9 ball|batter|cricket|duel|duelist|sling|slingers|dunk|goal|skate|pogo|cannon|sports|olympic|rugby|ping pong|tag|taggame|gym stack|throw a potato|qwop)\b/i.test(
      name
    )
  ) {
    return 'Sports & Physics';
  }

  // 6. Emulators & Ports (console ROMs, hacks, PC/indie ports)
  if (
    /(pokemon|zelda|ocarina|link's awakening|links awakening|minish cap|oracle of seasons|spirit tracks|phantom hourglass|majora's mask|final fantasy|chrono trigger|earthbound|mother 2|mother 3|secret of mana|golden sun|fire emblem|advance wars|etrian odyssey|kingdom hearts|persona|mega man|megaman|metroid|castlevania|kirby|donkey kong|star fox|banjo|conker|goldeneye|perfect dark|turok|animal crossing|harvest moon|tomodachi|nintendogs|phoenix wright|scribblenauts|style savvy|grand theft auto|gta1|gta2|gta advance|max payne|call of duty|rainbow six|half-life|codename: gordon|portal|duke nukem|wolfenstein|diablo|baldur's gate|baldurs gate|elder scrolls|terraria|minecraft|undertale|deltarune|hollow knight|celeste|cuphead|ultrakill|binding of isaac|thebindingofisaac|brotato|oneshot|danganronpa|touhou|cave story|spelunky|meat boy|antonblast|postal|little big planet|super monkey ball|lego batman|lego indiana|lego ninjago|crash bandicoot|rayman|street fighter|mortal kombat|killer instinct|bushido blade|twisted metal|oregon trail|ruffle|pico-8|javascriptps1|portaboy|fallout|quake|doom|zdoom|2doom|wario|waluigi|yoshi|metal gear|james bond|medal of honor|star raiders|pepsiman|super noah|commander keen|apotris|another world|super smash|dbz|dragon ball|bleach vs naruto|fairy tale vs one piece|one piece|ben 10|nicktoons|spongebob|famidash|micro mages|scrapyard dog|switchblade|steel empire|jet force gemini|glover|puyo puyo|shw ultimate|smash remix|super tilt bros|nzp|sandstone)/i.test(
      name
    ) ||
    /\b(smt|gta|nes|snes|gba|nds|n64|psx|ps1|atari|emulator|game & watch)\b/i.test(name) ||
    /\((gba|nds|n64|nes|snes|psx|atari|classic|legacy|alt)\)/i.test(name)
  ) {
    return 'Emulators & Ports';
  }

  // 7. Skill & Platformer
  if (
    /(ovo|slope|vex|geometry|parkour|flappy|subway|obby|only up|getting over it|dadish|ice dodo|stickman hook|cluster rush|tunnel rush|rolly vortex|rolling sky|circloo|blumgi|fireboy|watergirl|red ball|fancy pants|chibi knight|choppy orc|rogue soul|henry stickmin|breakingthebank|breaking the bank|escapingtheprison|escaping the prison|stealing the diamond|infiltratingtheairship|infiltrating the airship|fleeingthecomplex|fleeing the complex|duck life|world's hardest game|worlds hardest game|impossible game|vvvvvv|level devil|this is the only level|achievement unlocked|bob the robber|tall man|stacky dash|spiral roll|tomb of the mask|crossy road|google dino|down the mountain|eagle ride|avalanche|slime laboratory|papa louie|wall crawler|light it up|jet rush|wave run|zrist|super oliver|potatoman|rodha|handshakes|makeover|high heels|jetpack joyride|justfall|3dash|little runmo|speedrun|stickman boost|baby kaizo|spiderdoll|dan the man|bigneontower|big neon tower|quickie world|advent neon|klifur|hanger 2|reach the core|red tie runner|flood runner|last horizon|get to the top|into ruins|icy purple head|cats love cake|baby chicco|diamond hollow|amorphous|blastronaut|dusk child|goodboy galaxy|pitfall|pull frog|n\+|shift|super house of dead ninjas|to the core|overburden|meatboygame|pico driller|pico hot|fire blob|iq ball|amidst the sky)/i.test(
      name
    ) ||
    /\b(run|runner|running|jump|jumper|jumpers|jumping|fall|falling|tower|climb|climber|adventure|platform|platformer|ninja|dash|dodge|balance|hop|bounce|swing|dino|kaji|layers roll|land ho|the pit|n|ascent|ray 2)\b/i.test(
      name
    )
  ) {
    return 'Skill & Platformer';
  }

  // 8. Puzzle & Casual
  if (
    /(clicker|idle|tycoon|simulator|2048|chess|checkers|sudoku|mahjong|solitaire|blackjack|balatro|poker|roulette|plinko|cut the rope|cuttherope|bloxorz|wordle|crossword|water sort|infinite craft|grindcraft|sandspiel|sandbox|sandboxels|melon playground|squid playground|tiny fishing|webfishing|papa's|papas|papapizza|cooking mama|penguin diner|monkey mart|mini mart|supermarket|clothing shop|restaurant|hotel|resort|pottery|bitlife|pou|gacha|tamagotchi|impossible quiz|trivia|google feud|there is no game|please dont touch|we become what we behold|a dark room|bloons|btd|pvz|plants vs|tower defense|royaltowermedievaltd|age of war|age of empires|ages of conflict|state\.io|territorial|shapez|cell machine|waterworks|factory balls|snail bob|wheely|amigo pancho|sugar sugar|suika|peggle|zuma|hextris|sandtris|stacktris|tiletopia|breaklock|amaze|a-maze|seat jam|kitty toy|gobble|steal a brainrot|steal brainrot|skibidi|doge miner|motherload|jacksmith|orb of creation|fisquarium|fishgame|hole\.io|attack hole|paper\.io|slither\.io|agar\.io|growden|cheese chompers|hide n seek|crazy chicken|crazychicken|crazy kitty|build a queen|kitchen bazar|final earth|fitness empire|money rush|shovel 3d|outhold|scratch inc|myteardrop|love letters|three goblets|apple worm|3 slices|dumb ways to die|feeding a black hole|date danger|day in the office|allocation|side effects|pastry party|krabby katch|sandy's sponge|class of '09|class of 09|academytale|kindergarten|douchebag life|innkeeper|blacksmith lab|coffee maker|elastic face|fatty genius|gold digger|greed|grey box|harold's bad day|jefflings|multitask|not your pawn|obey the game|opposite day|penguin pass|pieces of cake|pikwip|plangman|pre-bronze|pre-civilization|resizer|rotate|slipways|slot or not|spewer|sundaes|sushi cat|sushi unroll|telephone trouble|telocation|the classroom|theme park|toastarling|too many types|trace|trap the cat|troll face|upgrade complete|villager|windows doors|you are lucky|code editor|chat bot|aichatbot|ai chatbot|helios|nautilis|play!\.js|silkapp|proxy|comments|apps|gamepage|globalchat|index|mobile|1game|\bai\b|\bchat\b|silk|mindwave|puppet master|customer support|pretend its not there|cheshire in a chatroom|focus|free gemas|clean up|cleanup|dig deep|dig to china|infinimoes|nijika|woke up next to you|groon groon|game inside a game|stone grass|happy sheepies|diamond seeker|chips challenge|dire decks|shark game|unogame|high stakes|no more games|nuts and bolts|bunnyland|big time butter baron|de blob 2|sun and moon|mindscape|underneath|ufo swamp odyssey|don't you lecture me)/i.test(
      name
    ) ||
    /\b(sim|uno|slot|candy|block|blocks|word|puzzle|match|sort|merge|alchemy|craft|quiz|feud|guess|riddle|escape|room|td|mine|miner|mining|upgrade|evol|evolution|fishing|farm|harvest|diner|cafe|bakery|pizza|burger|cake|sushi|cat|pet|dog|fish|card|cards|dice|minesweeper|tap|taps|brain|logic|memory|connect|color|colour|paint|art|clean|draw|slice|bolt|rope|fashion|money|tiny|chill|life|story|land|primary|porter)\b/i.test(
      name
    )
  ) {
    return 'Puzzle & Casual';
  }

  // 9. Retro & Arcade
  if (
    special.includes('flash') ||
    /(pacman|pac-man|dig dug|q\*bert|qbert|bomberman|metal slug|xevious|centipede|missile command|missle command|battlezone|duck hunt|lode runner|bubsy|earthworm jim|alien hominid|fruit ninja|bad ice cream|bad icecream|miami shark|new york shark|los angeles shark|sydney shark|medieval shark|prehistoric shark|tasty planet|happy room|ball blast|cubefield|blocky snakes|shipo|slime\.io|tall\.io|snowball\.io|paper\.io|galaga|asteroids|tetris|pinball|tempest|tapper|lemmings|contra|time warriors|star raiders|retro|arcade|flash|8-bit|8bit|gunblood|whack|feed us|effing|defend your|storm the house|stick rpg|sonny|creeper|breakout|pong|snake|pac|mario|sonic|hobo|dubstep|edelweiss|arsonate|mobius revolution|temp overdose)/i.test(
      name
    ) ||
    /\b(space|brick|bricks|atari|commodore|pixel|classic|swords|knight|castle|e\.t\.|grimace's birthday|opposum|scuba bear|vanguard|woodworm|you vs 100|duck)\b/i.test(
      name
    )
  ) {
    return 'Retro & Arcade';
  }

  // 10. Action & Shooters
  return 'Action & Shooters';
}

export function convertToGitHack(url: string): string {
  if (!url) return '';
  if (url.includes('jsdelivr.net')) {
    return url
      .replace('https://cdn.jsdelivr.net/gh/', 'https://raw.githack.com/')
      .replace('https://cdn.jsdelivr.net', 'https://raw.githack.com')
      .replace('https://jsdelivr.net', 'https://raw.githack.com')
      .replace('@main/', '/main/');
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${UGS_BASE_URL}${cleanPath}`;
}

export function resolveUgsUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/ckv/')) {
    return `https://wanocapy.github.io/ChickenKingsVault/${url.replace('/ckv/', '')}`;
  }
  return convertToGitHack(url);
}

export function generateGameSvgCover(title: string, category: string): string {
  const palettes = [
    ['#2563eb', '#1d4ed8'],
    ['#7c3aed', '#5b21b6'],
    ['#db2777', '#9d174d'],
    ['#059669', '#065f46'],
    ['#d97706', '#92400e'],
    ['#0891b2', '#155e75'],
    ['#dc2626', '#991b1b'],
    ['#4f46e5', '#3730a3'],
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const [c1, c2] = palettes[Math.abs(hash) % palettes.length];
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeCat = (category || 'ARCADE').toUpperCase().replace(/&/g, '&amp;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
      <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.25" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#g)" />
    <rect width="400" height="300" fill="url(#overlay)" />
    <circle cx="340" cy="50" r="100" fill="#ffffff" fill-opacity="0.08" />
    <circle cx="60" cy="250" r="80" fill="#000000" fill-opacity="0.15" />
    <text x="28" y="44" fill="#ffffff" fill-opacity="0.8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="11" letter-spacing="2">${safeCat}</text>
    <text x="28" y="145" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="26" letter-spacing="-0.5">
      ${safeTitle.length > 22 ? safeTitle.slice(0, 20) + '...' : safeTitle}
    </text>
    <rect x="28" y="235" width="80" height="28" rx="14" fill="#ffffff" fill-opacity="0.25" />
    <text x="68" y="253" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="11" letter-spacing="1">PLAY</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const GN_MATH_EXCLUSIVE_NORMS = new Set<string>([
  'undertale',
  'dokidokiliteratureclub',
  'ddlc',
  'soundboard',
  'soundboard2',
  'gemini',
  'duckduckgo',
  'myinstants',
]);

const EXCLUDED_CKV_PATHS = new Set<string>([
  '/ckv/gamefiles/castlevaniaadventure.html',
  '/ckv/gamefiles/stealthmasters.html',
  '/ckv/gamefiles/thatsnotmyneighbour.html',
  '/ckv/gamefiles/bulletforce.html',
  '/ckv/gamefiles/madnesscombatprojectnexus.html',
  '/ckv/gamefiles/thebindingofisaacwrathofthelambeternal.html',
  '/ckv/gamefiles/index.html',
  '/ckv/gamefiles/apps.html',
  '/ckv/gamefiles/gamepage.html',
  '/ckv/gamefiles/mobile.html',
  '/ckv/gamefiles/ai.html',
  '/ckv/gamefiles/aichatbot.html',
  '/ckv/gamefiles/chat.html',
  '/ckv/gamefiles/globalchat.html',
  '/ckv/gamefiles/helios browser.html',
  '/ckv/gamefiles/nautilis os.html',
  '/ckv/gamefiles/play!.js.html',
  '/ckv/gamefiles/sandstone proxy.html',
  '/ckv/gamefiles/proxy.html',
  '/ckv/gamefiles/silkapp.html',
  '/ckv/gamefiles/ruffleemu.html',
  '/ckv/gamefiles/btd1.html',
  '/ckv/gamefiles/btd2.html',
  '/ckv/gamefiles/btd3.html',
  '/ckv/gamefiles/btd4.html',
  '/ckv/gamefiles/btd5.html',
  '/ckv/gamefiles/legend of zelda links awakening.html',
  '/ckv/gamefiles/ocarinaoftime.html',
  '/ckv/gamefiles/baldurs gate 2.html',
  '/ckv/gamefiles/idle-shark/index.html',
  '/ckv/gamefiles/danganronpa.html',
  '/ckv/gamefiles/pvz2.html',
  '/ckv/gamefiles/ddlc.html',
]);

const SLUG_CANONICAL_OVERRIDES: Record<string, string> = {
  '1game': '1',
  '2doomgame': 'doom 2',
  'zdoomgame': 'doom',
  'icedodo': 'ice dodo',
  'royaltowermedievaltd': 'royal towers medieval td',
  'bigneontowertinysqaure': 'big neon tower tiny square',
  'cuttheropeholiday': 'cut the rope holiday gift',
  'milkinsideabagofmilk': 'milk inside a bag of milk inside a bag of milk',
  'milkoutsideabagofmilk': 'milk outside a bag of milk outside a bag of milk',
  'fearstofathom': 'fears to fathom home alone',
  'hilclimbracing': 'hill climb racing',
  'hillclimbracing': 'hill climb racing',
  'kirbysoftandwet': 'kirby soft and wet',
  'nzp': 'nazi zombies portable',
  'quake3arena': 'quake iii arena',
  'pvz': 'plants vs zombies',
  'catgunner': 'cat gunner super zombie shoot',
  'chessgame': 'chess classic',
  'fnaf': 'five nights at freddys',
  'fnaf2': 'five nights at freddys 2',
  'fnaf3': 'five nights at freddys 3',
  'fnaf4': 'five nights at freddys 4',
  'fnafpizzasim': 'five nights at freddys pizza simulator',
  'fnafucn': 'five nights at freddys ultimate custom night',
  'fnafworld': 'five nights at freddys world',
  'fnf': 'friday night funkin',
  'fnfvshatsunemiku': 'friday night funkin vs hatsune miku',
  'telekinesisgame': 'telekinesis attack',
  'breakingthebank': 'henry stickmin breaking the bank',
  'escapingtheprison': 'henry stickmin escaping the prison',
  'infiltratingtheairship': 'henry stickmin infiltrating the airship',
  'fleeingthecomplex': 'henry stickmin fleeing the complex',
  'stealingthediamond': 'henry stickmin stealing the diamond',
  'revelationspersona': 'persona',
  'minecraft173': 'minecraft beta 1.7.3',
  'minecraft1.7.3': 'minecraft beta 1.7.3',
  'cod4modernwarfare': 'call of duty 4',
  'googledino': 'google dino run',
  'legobatmanthevideogame': 'lego batman',
  'legobatman2dcsuperheroes': 'lego batman 2',
  'celestepico': 'celeste pico',
  'celestegame': 'celeste',
};

function normalizeGameKey(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower === 'n+') return 'nplus';
  return lower.replace(/[^a-z0-9]/g, '');
}

function getCanonicalGameKeys(name: string, url?: string): string[] {
  let s = name.trim().toLowerCase();
  if (s === 'n+') return ['nplus'];

  if (url && url.toLowerCase().startsWith('/ckv/')) {
    const slug = url.split('/').pop()?.replace(/\.html$/i, '').toLowerCase() || '';
    if (SLUG_CANONICAL_OVERRIDES[slug]) {
      s = SLUG_CANONICAL_OVERRIDES[slug];
    }
  }

  s = s.replace(/\s*\([^)]*\)\s*$/g, (m) =>
    /\((alt|clean|best|legacy|raw|old|classic|remake|flash|decomp|goober|psx|psx alt|gba|nes|snes|n64|ds|gamecube|tabs|1999|sans|multiplayer|unblocked|hd|game)\)/i.test(m)
      ? ''
      : m
  );

  s = s
    .replace(/['’]s\b/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bvs\.?\b/g, ' vs ')
    .replace(/\btower defense\b/g, ' td ')
    .replace(/\bissac\b/g, 'isaac')
    .replace(/\bsqaure\b/g, 'square')
    .replace(/\bpico[\s-]*8\b/g, 'pico')
    .replace(/\b(the video game|dc super heroes|dc superheroes|edition|with bennett foddy)\b/g, ' ')
    .replace(/\bhill climb racing lite\b/g, 'hill climb racing')
    .replace(/\btouhou\s*(\d+)\s*touhou[\s-]*/g, 'touhou $1 ')
    .replace(/\bslender:\s*the eight pages\b/g, 'slender the 8 pages')
    .replace(/\bfnaf\b/g, 'five nights at freddy')
    .replace(/\bgrand theft auto\b/g, 'gta')
    .replace(/\b(the )?legends? of zelda\b/g, 'zelda')
    .replace(/\b(henry stickmin|stickman)\b/g, 'stickman')
    .replace(/\bthe\s+/g, '')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\biv\b/g, '4')
    .replace(/\s+(game|play|online|free|unblocked)$/g, '');

  let compact = s.replace(/[^a-z0-9]/g, '');
  if (compact.length > 5 && compact.endsWith('game')) {
    compact = compact.slice(0, -4);
  }

  const keys = new Set<string>();
  const rawCompact = normalizeGameKey(name);
  if (rawCompact) keys.add(rawCompact);
  if (compact) keys.add(compact);
  if (compact.endsWith('1') && compact.length >= 4 && !/^\d+$/.test(compact)) {
    keys.add(compact.slice(0, -1));
  }
  if (compact === 'plantsvszombies2') {
    keys.add('plantsvszombies2gardenless');
  }
  return Array.from(keys);
}

export function transformUgsEntry(
  entry: { name: string; url: string; img?: string; category?: GameCategory },
  idSeed: number,
  existingNames: Set<string>,
  coverLookupByName: Map<string, string>,
  targetLibrary?: 'ugs' | 'ckv'
): GameItem | null {
  if (!entry || !entry.name || !entry.url) return null;
  const trimmedName = entry.name.trim();
  if (!trimmedName || trimmedName.includes('.gg/')) return null;

  const lowerUrl = entry.url.trim().toLowerCase();
  const isCkv = lowerUrl.startsWith('/ckv/') || targetLibrary === 'ckv';
  if (isCkv && EXCLUDED_CKV_PATHS.has(lowerUrl)) {
    return null;
  }

  const normalized = normalizeGameKey(trimmedName);
  const canonicalKeys = getCanonicalGameKeys(trimmedName, entry.url);
  const isDeltarune = normalized === 'deltarune';
  if (isDeltarune) {
    if (isCkv || existingNames.has('ugs:deltarune')) {
      return null;
    }
    existingNames.add('ugs:deltarune');
  } else {
    if (GN_MATH_EXCLUSIVE_NORMS.has(normalized)) {
      return null;
    }
    if (canonicalKeys.some((k) => existingNames.has(k))) {
      return null;
    }
  }

  // Skip redundant (Alt)/(Clean)/(Best)/(Legacy)/(Raw)/(Old) variants when base already exists
  const variantMatch = trimmedName.match(/^(.*?)\s*\((alt|clean|best|legacy|raw|old)\)$/i);
  if (!isDeltarune && variantMatch) {
    const baseKey = normalizeGameKey(variantMatch[1]);
    if (existingNames.has(baseKey)) {
      return null;
    }
  }

  for (const k of canonicalKeys) {
    existingNames.add(k);
  }

  const id = 10000 + idSeed;
  const category = detectCategory({ name: trimmedName, url: entry.url, special: [], category: entry.category } as any);
  const resolvedUrl = resolveUgsUrl(entry.url);
  const library: GameLibraryId = isCkv ? 'ckv' : 'ugs';
  const isFeatured = FEATURED_NAMES.has(trimmedName);

  let resolvedCover = '';
  if (coverLookupByName.has(normalized)) {
    resolvedCover = coverLookupByName.get(normalized)!;
  } else if (entry.img && !entry.img.includes('placeholder.png') && (entry.img.startsWith('http://') || entry.img.startsWith('https://'))) {
    resolvedCover = entry.img;
  } else if (entry.img && entry.img.startsWith('/ckv/')) {
    resolvedCover = `https://wanocapy.github.io/ChickenKingsVault/${entry.img.replace('/ckv/', '')}`;
  } else {
    resolvedCover = generateGameSvgCover(trimmedName, category);
  }

  return {
    id,
    name: trimmedName,
    cover: resolvedCover,
    url: entry.url,
    category,
    library,
    resolvedCover,
    fallbackCover: resolvedCover,
    localCover: resolvedCover,
    resolvedUrl,
    featured: isFeatured,
    source: isCkv ? 'CKV' : 'ugs',
    rating: resolveGameRating(trimmedName),
  };
}

/**
 * Fetches the game list directly from raw.githack.com UGS index,
 * with fallback to jsDelivr and local bundled mirror.
 */
export async function getUGSGames(): Promise<Array<{ name: string; url: string; img?: string }>> {
  try {
    const res = await fetch(UGS_INDEX_URL, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return rawUgsData as Array<{ name: string; url: string; img?: string }>;
  } catch (err) {
    try {
      const fallbackRes = await fetch('https://cdn.jsdelivr.net/gh/gmshelf/ugs@main/ugs.json', { signal: AbortSignal.timeout(6000) });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData) && fallbackData.length > 0) {
          return fallbackData;
        }
      }
    } catch {}
    return rawUgsData as Array<{ name: string; url: string; img?: string }>;
  }
}

/**
 * Fetches latest games dynamically from ChickenKingsVault games.js
 */
export async function getCKVGames(): Promise<Array<{ name: string; url: string; img?: string }>> {
  try {
    const res = await fetch('https://raw.githubusercontent.com/WanoCapy/ChickenKingsVault/main/games.js', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const matches = [...text.matchAll(/<a class="game-link" href="([^"]+)">\s*<img src="([^"]+)"[^>]*>\s*<div>([^<]+)<\/div>/g)];
    if (matches.length > 0) {
      return matches.map((m) => ({
        name: m[3].trim(),
        url: `/ckv/${m[1].trim().replace(/^\//, '')}`,
        img: `https://wanocapy.github.io/ChickenKingsVault/${m[2].trim().replace(/^\//, '')}`,
      }));
    }
    return rawCkvData as Array<{ name: string; url: string; img?: string }>;
  } catch {
    return rawCkvData as Array<{ name: string; url: string; img?: string }>;
  }
}

export function mergeUgsGames(
  baseGames: GameItem[],
  dynamicList: Array<{ name: string; url: string; img?: string }>,
  targetLibrary: 'ugs' | 'ckv' = 'ugs'
): GameItem[] {
  const existingNames = new Set<string>(GN_MATH_EXCLUSIVE_NORMS);
  const coverLookupByName = new Map<string, string>();
  const usedIds = new Set<number>();

  for (const g of baseGames) {
    usedIds.add(g.id);
    const norm = normalizeGameKey(g.name);
    // Strict hierarchy: UGS skips anything in GN-Math or UGS; CKV skips anything in GN-Math, UGS, or CKV
    const shouldBlock =
      g.library === 'gn-math' ||
      g.library === 'ugs' ||
      (targetLibrary === 'ckv' && g.library === 'ckv');
    if (shouldBlock) {
      if (norm === 'deltarune' && g.library === 'ugs') {
        existingNames.add('ugs:deltarune');
      }
      for (const k of getCanonicalGameKeys(g.name, g.url)) {
        existingNames.add(k);
      }
    }
    if (g.resolvedCover && !g.resolvedCover.startsWith('data:image/svg+xml') && !coverLookupByName.has(norm)) {
      coverLookupByName.set(norm, g.resolvedCover);
    }
  }

  let nextIdSeed = targetLibrary === 'ckv' ? 20000 : 0;
  const newGames: GameItem[] = [];
  for (let i = 0; i < dynamicList.length; i++) {
    while (usedIds.has(10000 + nextIdSeed)) {
      nextIdSeed++;
    }
    const transformed = transformUgsEntry(dynamicList[i], nextIdSeed, existingNames, coverLookupByName, targetLibrary);
    if (transformed) {
      usedIds.add(transformed.id);
      newGames.push(transformed);
      nextIdSeed++;
    }
  }

  if (newGames.length === 0) return baseGames;
  return [...baseGames, ...newGames];
}

export function getPlayableGameUrl(game: GameItem): string {
  if (!game) return '';
  const name = (game.name || '').toLowerCase().trim();
  if (name === 'undertale') {
    return 'https://sethabout3653-sketch.github.io/undertale-webportforfrosthub/';
  }
  // Native GN-Math games are fine and use standard resolution
  if (game.source === 'native') {
    return game.resolvedUrl || resolveGameUrl(game.url, game.id);
  }
  if (game.url && (game.url.startsWith('http://') || game.url.startsWith('https://'))) {
    return game.url;
  }
  const isStaticHost =
    typeof window !== 'undefined' &&
    (/\.(vercel\.app|pages\.dev|netlify\.app|github\.io)$/i.test(window.location.hostname) ||
      window.location.protocol === 'about:');
  if (game.source === 'ugs' || game.url.startsWith('/ugs/')) {
    if (isStaticHost) {
      return resolveUgsUrl(game.url);
    }
    const clean = game.url.replace(/^\/ugs\//, '').replace(/^\//, '');
    return `/api/ugs/${clean}`;
  }
  if (game.source === 'CKV' || game.url.startsWith('/ckv/')) {
    if (isStaticHost) {
      return resolveUgsUrl(game.url);
    }
    const clean = game.url.replace(/^\/ckv\//, '').replace(/^\//, '');
    return `/api/ckv/${clean}`;
  }
  return resolveGameUrl(game.url, game.id);
}

/**
 * GN-Math native games run directly by default ("except gn-math games they are fine").
 * External URLs, UGS, and CKV games run via Scramjet v2 by default unless explicitly configured otherwise.
 * Undertale runs directly via the official webport without Scramjet.
 */
export function shouldUseScramjetByDefault(game: GameItem): boolean {
  if (!game) return false;
  const name = (game.name || '').toLowerCase().trim();
  if (name === 'undertale' || game.url?.includes('undertale-webportforfrosthub')) {
    return false;
  }
  if (game.source === 'scramjet') return true;
  const scramjetAllowed = new Set([
    'gemini',
    'soundboard 2',
    'soundboard 2 ',
    'soundboard',
    'deltarune',
    'duckduckgo',
  ]);
  return scramjetAllowed.has(name);
}

/**
 * Resolves the absolute upstream target URL required by Scramjet frame.go(url).
 */
export function getScramjetTargetUrl(game: GameItem): string {
  if (!game) return '';
  const name = (game.name || '').toLowerCase().trim();
  if (name === 'undertale') {
    return 'https://sethabout3653-sketch.github.io/undertale-webportforfrosthub/';
  }
  if (game.url && (game.url.startsWith('http://') || game.url.startsWith('https://'))) {
    return game.url;
  }
  if (game.source === 'CKV' || game.url.startsWith('/ckv/')) {
    const clean = game.url.replace(/^\/ckv\//, '').replace(/^\//, '');
    return `https://wanocapy.github.io/ChickenKingsVault/${clean}`;
  }
  if (game.source === 'ugs' || game.url.startsWith('/ugs/')) {
    return resolveUgsUrl(game.url);
  }
  return game.resolvedUrl || resolveGameUrl(game.url, game.id);
}

function generateSoundboardSvgCover(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <linearGradient id="sbBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="50%" stop-color="#1e1035" />
        <stop offset="100%" stop-color="#0b1120" />
      </linearGradient>
      <radialGradient id="sbGlow" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stop-color="#ec4899" stop-opacity="0.32" />
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="btnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ff4b4b" />
        <stop offset="100%" stop-color="#c81e1e" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect width="400" height="300" fill="url(#sbBg)" />
    <rect width="400" height="300" fill="url(#sbGlow)" />
    <!-- Audio Waveform decorative bars -->
    <g opacity="0.25">
      <rect x="52" y="90" width="8" height="36" rx="4" fill="#a855f7" />
      <rect x="68" y="74" width="8" height="68" rx="4" fill="#ec4899" />
      <rect x="84" y="82" width="8" height="52" rx="4" fill="#38bdf8" />
      <rect x="308" y="82" width="8" height="52" rx="4" fill="#38bdf8" />
      <rect x="324" y="74" width="8" height="68" rx="4" fill="#ec4899" />
      <rect x="340" y="90" width="8" height="36" rx="4" fill="#a855f7" />
    </g>
    <!-- Instant Button Base & Cap -->
    <ellipse cx="200" cy="128" rx="64" ry="34" fill="#334155" filter="url(#shadow)" />
    <ellipse cx="200" cy="122" rx="58" ry="30" fill="#475569" />
    <ellipse cx="200" cy="116" rx="52" ry="26" fill="url(#btnGrad)" />
    <ellipse cx="200" cy="112" rx="44" ry="20" fill="#ff6b6b" opacity="0.7" />
    <!-- Speaker / Sound icon highlight in button -->
    <path d="M192 108 L197 108 L203 103 L203 121 L197 116 L192 116 Z" fill="#ffffff" />
    <path d="M206 108 A4 4 0 0 1 206 116" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" />
    <path d="M209 105 A8 8 0 0 1 209 119" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" />
    <text x="200" y="206" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" letter-spacing="-0.5">Soundboard</text>
    <rect x="136" y="222" width="128" height="22" rx="11" fill="#ec4899" fill-opacity="0.2" stroke="#ec4899" stroke-width="1" stroke-opacity="0.5" />
    <text x="200" y="237" text-anchor="middle" fill="#f472b6" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="10" letter-spacing="1.5">BY MYINSTANTS</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const FEATURED_APP_CONFIG = {
  tiktok: {
    name: 'Soundboard 2 ',
    url: 'https://www.soundboardguys.com',
    coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSV-0qsakVXtbgjO5dYAWUse_0I8vWZJwuE88NkBZY8Og&s',
  },
  soundboard: {
    name: 'Soundboard',
    url: 'https://www.myinstants.com/en/index/us/',
    coverUrl: 'https://cdn.aptoide.com/imgs/d/e/c/dec9bc1d63944581077bfa41b5188aa3_icon.png',
  },
  google: {
    name: 'Gemini',
    url: 'https://gemini.google.com',
    coverUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Google_Gemini_icon_2025.svg/960px-Google_Gemini_icon_2025.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
  },
  duckduckgo: {
    name: 'Duckduckgo',
    url: 'https://duckduckgo.com',
    coverUrl: '/assets/duckduckgo.svg',
    author: 'DuckDuckGo',
  },
  ddlc: {
    name: 'Doki Doki Literature Club',
    url: 'https://sethabout3653-sketch.github.io/EmeraldGreenR.github.io/',
    coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRMamlkw5KBVusv5915HUGcPYcq7bVp4q1bvP60VydMhw&s=10',
    author: 'By Steam',
  },
  undertale: {
    name: 'Undertale',
    url: 'https://sethabout3653-sketch.github.io/undertale-webportforfrosthub/',
    coverUrl: 'https://raw.githubusercontent.com/WanoCapy/ChickenKingsVault/main/gameimages/undertale.png',
    author: 'Toby Fox',
  },
};

const BUILTIN_SCRAMJET_GAMES: GameItem[] = [
  {
    id: 900002,
    name: FEATURED_APP_CONFIG.tiktok.name,
    cover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    url: FEATURED_APP_CONFIG.tiktok.url,
    author: 'Soundboard Guys',
    special: ['tiktok', 'video', 'videos', 'short videos', 'scramjet'],
    featured: true,
    source: 'scramjet',
    library: 'gn-math',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    fallbackCover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    localCover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.tiktok.url,
  },
  {
    id: 900001,
    name: FEATURED_APP_CONFIG.soundboard.name,
    cover: FEATURED_APP_CONFIG.soundboard.coverUrl,
    url: FEATURED_APP_CONFIG.soundboard.url,
    author: 'Myinstants',
    special: ['soundboard', 'myinstants', 'audio', 'sound effects', 'buttons', 'scramjet'],
    featured: true,
    source: 'scramjet',
    library: 'gn-math',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.soundboard.coverUrl,
    fallbackCover: generateSoundboardSvgCover(),
    localCover: FEATURED_APP_CONFIG.soundboard.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.soundboard.url,
  },
  {
    id: 900003,
    name: FEATURED_APP_CONFIG.google.name,
    cover: FEATURED_APP_CONFIG.google.coverUrl,
    url: FEATURED_APP_CONFIG.google.url,
    author: 'By Google',
    special: ['google', 'search', 'scramjet'],
    featured: true,
    source: 'scramjet',
    library: 'gn-math',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.google.coverUrl,
    fallbackCover: FEATURED_APP_CONFIG.google.coverUrl,
    localCover: FEATURED_APP_CONFIG.google.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.google.url,
  },
  {
    id: 900005,
    name: FEATURED_APP_CONFIG.duckduckgo.name,
    cover: FEATURED_APP_CONFIG.duckduckgo.coverUrl,
    url: FEATURED_APP_CONFIG.duckduckgo.url,
    author: FEATURED_APP_CONFIG.duckduckgo.author,
    special: ['duckduckgo', 'duck duck go', 'search', 'privacy', 'browser', 'scramjet'],
    featured: true,
    source: 'scramjet',
    library: 'gn-math',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.duckduckgo.coverUrl,
    fallbackCover: '/assets/duckduckgo.png',
    localCover: FEATURED_APP_CONFIG.duckduckgo.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.duckduckgo.url,
  },
  {
    id: 900004,
    name: FEATURED_APP_CONFIG.ddlc.name,
    cover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    url: FEATURED_APP_CONFIG.ddlc.url,
    author: FEATURED_APP_CONFIG.ddlc.author,
    special: ['doki doki', 'literature club', 'ddlc', 'steam', 'horror'],
    featured: true,
    source: 'native',
    library: 'gn-math',
    category: 'Horror & Mystery',
    resolvedCover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    fallbackCover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    localCover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.ddlc.url,
  },
  {
    id: 900006,
    name: FEATURED_APP_CONFIG.undertale.name,
    cover: FEATURED_APP_CONFIG.undertale.coverUrl,
    url: FEATURED_APP_CONFIG.undertale.url,
    author: FEATURED_APP_CONFIG.undertale.author,
    special: ['undertale', 'rpg', 'port', 'toby fox'],
    featured: true,
    source: 'native',
    library: 'gn-math',
    category: 'Emulators & Ports',
    resolvedCover: FEATURED_APP_CONFIG.undertale.coverUrl,
    fallbackCover: generateGameSvgCover('Undertale', 'Emulators & Ports'),
    localCover: generateGameSvgCover('Undertale', 'Emulators & Ports'),
    resolvedUrl: FEATURED_APP_CONFIG.undertale.url,
  },
];

export function getAllGames(): GameItem[] {
  // 1. ALL VALID GN-MATH GAMES (EXCEPT deleted native soundboard id: 179)
  const validGames = (rawGamesData as RawGame[]).filter(
    (g) =>
      g.id >= 0 &&
      g.id !== 179 &&
      g.name &&
      !g.name.includes('.gg/') &&
      g.name.toLowerCase().trim() !== 'soundboard'
  );

  const gnGames: GameItem[] = validGames.map((game) => {
    const isFeatured = FEATURED_NAMES.has(game.name) || Boolean(game.featured);
    const category = detectCategory(game);
    const resolvedCover = resolveCoverUrl(game.cover);
    const fallbackCover = getDirectCoverUrl(game.cover);
    const resolvedUrl = resolveGameUrl(game.url, game.id);

    return {
      ...game,
      source: 'native',
      library: 'gn-math',
      featured: isFeatured,
      category,
      resolvedCover,
      fallbackCover,
      localCover: resolvedCover,
      resolvedUrl,
      rating: resolveGameRating(game.name),
    };
  });

  // 2. Shared cover lookup & cumulative canonical key set (GN-Math -> UGS -> CKV)
  const coverLookupByName = new Map<string, string>();
  const sharedExistingNames = new Set<string>(GN_MATH_EXCLUSIVE_NORMS);

  const builtInsWithRatings = BUILTIN_SCRAMJET_GAMES.map((g) => ({
    ...g,
    library: 'gn-math' as GameLibraryId,
    rating: g.rating || resolveGameRating(g.name),
  }));

  for (const g of [...builtInsWithRatings, ...gnGames]) {
    const norm = normalizeGameKey(g.name);
    if (g.resolvedCover) {
      coverLookupByName.set(norm, g.resolvedCover);
    }
    for (const k of getCanonicalGameKeys(g.name, g.url)) {
      sharedExistingNames.add(k);
    }
  }

  // 3. UGS library (excludes everything in GN-Math, keeping Deltarune)
  const ugsGames: GameItem[] = [];
  const ugsList = rawUgsData as Array<{ name: string; url: string; img?: string; category?: GameCategory }>;
  for (let i = 0; i < ugsList.length; i++) {
    const transformed = transformUgsEntry(ugsList[i], i, sharedExistingNames, coverLookupByName, 'ugs');
    if (transformed) {
      ugsGames.push(transformed);
    }
  }

  // 4. CKV library (excludes everything in GN-Math and UGS)
  const ckvGames: GameItem[] = [];
  const ckvList = rawCkvData as Array<{ name: string; url: string; img?: string; category?: GameCategory }>;
  for (let i = 0; i < ckvList.length; i++) {
    const transformed = transformUgsEntry(ckvList[i], i + 20000, sharedExistingNames, coverLookupByName, 'ckv');
    if (transformed) {
      ckvGames.push(transformed);
    }
  }

  return [...builtInsWithRatings, ...gnGames, ...ugsGames, ...ckvGames];
}

export function deduplicateAcrossLibraries(games: GameItem[]): GameItem[] {
  const priority: Record<GameLibraryId, number> = {
    'gn-math': 0,
    'ugs': 1,
    'ckv': 2,
  };
  const ordered = [...games].sort((a, b) => priority[a.library] - priority[b.library]);
  const seenKeys = new Set<string>(GN_MATH_EXCLUSIVE_NORMS);
  const result: GameItem[] = [];

  for (const g of ordered) {
    const key = normalizeGameKey(g.name);
    const keys = getCanonicalGameKeys(g.name, g.url);

    if (g.library === 'gn-math') {
      for (const k of keys) {
        seenKeys.add(k);
      }
      result.push(g);
      continue;
    }

    if (key === 'deltarune') {
      if (g.library === 'ugs' && !seenKeys.has('ugs:deltarune')) {
        seenKeys.add('ugs:deltarune');
        seenKeys.add(key);
        result.push(g);
      }
      continue;
    }

    if (keys.some((k) => seenKeys.has(k))) {
      continue;
    }
    for (const k of keys) {
      seenKeys.add(k);
    }
    result.push(g);
  }
  return result;
}

export async function fetchGames(): Promise<GameItem[]> {
  return getAllGames();
}

import { getStoredGameFavorites, toggleGameFavorite as svcToggleGameFavorite } from './favoritesService';

const RECENT_KEY = 'melted_recent_ids';

export function getFavorites(): number[] {
  return getStoredGameFavorites();
}

export function toggleFavorite(id: number): boolean {
  const prev = getStoredGameFavorites();
  const wasFav = prev.includes(id);
  svcToggleGameFavorite(id);
  return !wasFav;
}

export function getRecentPlayed(): number[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function recordRecentPlay(id: number): void {
  try {
    const current = getRecentPlayed().filter((x) => x !== id);
    const updated = [id, ...current].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}
