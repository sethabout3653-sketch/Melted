export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: string;
  rawDuration: number;
  previewUrl: string;
  streamUrl?: string;
  isFullLength: boolean;
  lyrics?: string[];
  artistAvatar?: string;
}

export interface ArtistItem {
  id: string;
  name: string;
  avatar: string;
  genre?: string;
  followers?: string;
  popularTracks: TrackItem[];
  albums: AlbumItem[];
}

export interface AlbumItem {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  year: string;
  tracksCount: number;
  totalDuration: string;
  tracks: TrackItem[];
}

// -------------------------------------------------------------
// OFFICIAL ARTIST: MICHAEL JACKSON
// -------------------------------------------------------------
const MJ_AVATAR = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
const THRILLER_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80';
const BAD_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
const DANGEROUS_COVER = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80';

export const MJ_THRILLER_TRACKS: TrackItem[] = [
  {
    id: 'mj-billie-jean',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    album: 'Thriller',
    artwork: THRILLER_COVER,
    duration: '4:54',
    rawDuration: 294,
    previewUrl: 'https://archive.org/download/thriller-special-edition/06%20Billie%20Jean.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/thriller-special-edition/06%20Billie%20Jean.mp3'),
    isFullLength: true,
    lyrics: [
      "She was more like a beauty queen from a movie scene",
      "I said don't mind, but what do you mean, I am the one",
      "Who will dance on the floor in the round?",
      "She said I am the one, who will dance on the floor in the round",
      "She told me her name was Billie Jean, as she caused a scene",
      "Then every head turned with eyes that dreamed of being the one",
      "Who will dance on the floor in the round",
      "People always told me, be careful of what you do",
      "And don't go around breaking young girls' hearts",
      "And mother always told me, be careful of who you love",
      "And be careful of what you do, 'cause the lie becomes the truth",
      "Billie Jean is not my lover",
      "She's just a girl who claims that I am the one",
      "But the kid is not my son",
      "She says I am the one, but the kid is not my son"
    ]
  },
  {
    id: 'mj-beat-it',
    title: 'Beat It',
    artist: 'Michael Jackson',
    album: 'Thriller',
    artwork: THRILLER_COVER,
    duration: '4:18',
    rawDuration: 258,
    previewUrl: 'https://archive.org/download/thriller-special-edition/05%20Beat%20It.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/thriller-special-edition/05%20Beat%20It.mp3'),
    isFullLength: true,
    lyrics: [
      "They told him, 'Don't you ever come around here'",
      "'Don't wanna see your face, you better disappear'",
      "The fire's in their eyes and their words are really clear",
      "So beat it, just beat it",
      "You better run, you better do what you can",
      "Don't wanna see no blood, don't be a macho man",
      "You wanna be tough, better do what you can",
      "So beat it, but you wanna be bad",
      "Just beat it, beat it, beat it, beat it",
      "No one wants to be defeated",
      "Showin' how funky and strong is your fight",
      "It doesn't matter who's wrong or right",
      "Just beat it, beat it"
    ]
  },
  {
    id: 'mj-thriller',
    title: 'Thriller',
    artist: 'Michael Jackson',
    album: 'Thriller',
    artwork: THRILLER_COVER,
    duration: '5:58',
    rawDuration: 358,
    previewUrl: 'https://archive.org/download/thriller-special-edition/04%20Thriller.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/thriller-special-edition/04%20Thriller.mp3'),
    isFullLength: true,
    lyrics: [
      "It's close to midnight",
      "And something evil's lurking in the dark",
      "Under the moonlight",
      "You see a sight that almost stops your heart",
      "You try to scream, but terror takes the sound before you make it",
      "You start to freeze as horror looks you right between the eyes",
      "You're paralyzed",
      "'Cause this is thriller, thriller night",
      "And no one's gonna save you from the beast about to strike",
      "You know it's thriller, thriller night",
      "You're fighting for your life inside a killer thriller tonight"
    ]
  },
  {
    id: 'mj-wanna-be-startin',
    title: "Wanna Be Startin' Somethin'",
    artist: 'Michael Jackson',
    album: 'Thriller',
    artwork: THRILLER_COVER,
    duration: '6:02',
    rawDuration: 362,
    previewUrl: 'https://archive.org/download/thriller-special-edition/01%20Wanna%20Be%20Startin%27%20Somethin%27.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/thriller-special-edition/01%20Wanna%20Be%20Startin%27%20Somethin%27.mp3'),
    isFullLength: true,
    lyrics: [
      "I said you wanna be startin' somethin'",
      "You got to be startin' somethin'",
      "I said you wanna be startin' somethin'",
      "You got to be startin' somethin'",
      "It's too high to get over (Yeah, yeah)",
      "Too low to get under (Yeah, yeah)",
      "You're stuck in the middle (Yeah, yeah)",
      "And the pain is thunder (Yeah, yeah)"
    ]
  },
  {
    id: 'mj-human-nature',
    title: 'Human Nature',
    artist: 'Michael Jackson',
    album: 'Thriller',
    artwork: THRILLER_COVER,
    duration: '4:06',
    rawDuration: 246,
    previewUrl: 'https://archive.org/download/thriller-special-edition/07%20Human%20Nature.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/thriller-special-edition/07%20Human%20Nature.mp3'),
    isFullLength: true,
    lyrics: [
      "Looking out across the nighttime",
      "The city winks a sleepless eye",
      "Hear her voice, shake my window",
      "Sweet seducing sighs",
      "Get me out into the nighttime",
      "Four walls won't hold me tonight",
      "If this town is just an apple",
      "Then let me take a bite",
      "Tell them that it's human nature",
      "Why, why does he do me that way?",
      "Tell them that it's human nature"
    ]
  },
  {
    id: 'mj-pyt',
    title: 'P.Y.T. (Pretty Young Thing)',
    artist: 'Michael Jackson',
    album: 'Thriller',
    artwork: THRILLER_COVER,
    duration: '3:59',
    rawDuration: 239,
    previewUrl: 'https://archive.org/download/thriller-special-edition/08%20P.Y.T.%20(Pretty%20Young%20Thing).mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/thriller-special-edition/08%20P.Y.T.%20(Pretty%20Young%20Thing).mp3'),
    isFullLength: true,
    lyrics: [
      "Where did you come from, lady?",
      "And ooh, won't you take me there?",
      "Right to beside you, baby",
      "You touch me, drive me crazy",
      "Tender lovin' care",
      "I want to love you, P.Y.T. (Pretty Young Thing)",
      "You need some lovin', T.L.C. (Tender Lovin' Care)"
    ]
  }
];

export const MJ_BAD_TRACKS: TrackItem[] = [
  {
    id: 'mj-smooth-criminal',
    title: 'Smooth Criminal',
    artist: 'Michael Jackson',
    album: 'Bad',
    artwork: BAD_COVER,
    duration: '4:17',
    rawDuration: 257,
    previewUrl: 'https://archive.org/download/HeeHeee..../10-Smooth%20Criminal%20%5B2012%20Remaster%5D.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/HeeHeee..../10-Smooth%20Criminal%20%5B2012%20Remaster%5D.mp3'),
    isFullLength: true,
    lyrics: [
      "As he came into the window",
      "Was a sound of a crescendo",
      "He came into her apartment",
      "He left the bloodstains on the carpet",
      "She ran underneath the table",
      "He could see she was unable",
      "So she ran into the bedroom",
      "She was struck down, it was her doom",
      "Annie, are you okay? So, Annie, are you okay?",
      "Are you okay, Annie?",
      "Annie, are you okay? So, Annie, are you okay?",
      "Are you okay, Annie?",
      "You've been hit by, you've been hit by",
      "A smooth criminal!"
    ]
  },
  {
    id: 'mj-bad',
    title: 'Bad',
    artist: 'Michael Jackson',
    album: 'Bad',
    artwork: BAD_COVER,
    duration: '4:07',
    rawDuration: 247,
    previewUrl: 'https://archive.org/download/HeeHeee..../01-Bad%20%5B2012%20Remaster%5D.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/HeeHeee..../01-Bad%20%5B2012%20Remaster%5D.mp3'),
    isFullLength: true,
    lyrics: [
      "Your butt is mine, gonna tell you right",
      "Just show your face in broad daylight",
      "I'm telling you on who I feel",
      "Gonna hurt your mind, don't shoot to kill",
      "Shamone, shamone, lay it on me",
      "Because I'm bad, I'm bad, come on (Really, really bad)",
      "You know I'm bad, I'm bad, you know it (Really, really bad)",
      "And the whole world has to answer right now",
      "Just to tell you once again, who's bad?"
    ]
  },
  {
    id: 'mj-the-way-you-make-me-feel',
    title: 'The Way You Make Me Feel',
    artist: 'Michael Jackson',
    album: 'Bad',
    artwork: BAD_COVER,
    duration: '4:58',
    rawDuration: 298,
    previewUrl: 'https://archive.org/download/HeeHeee..../02-The%20Way%20You%20Make%20Me%20Feel%20%5B2012%20Remaster%5D.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/HeeHeee..../02-The%20Way%20You%20Make%20Me%20Feel%20%5B2012%20Remaster%5D.mp3'),
    isFullLength: true,
    lyrics: [
      "Hee-hee! Ooh! Go on, girl!",
      "Hey pretty baby with the high heels on",
      "You give me fever like I've never, ever known",
      "You're just a product of loveliness",
      "I like the groove of your walk, your talk, your dress",
      "The way you make me feel (The way you make me feel)",
      "You really turn me on (You really turn me on)",
      "You knock me off of my feet (Knock me off of my feet)",
      "My lonely days are gone (My lonely days are gone)"
    ]
  },
  {
    id: 'mj-man-in-the-mirror',
    title: 'Man in the Mirror',
    artist: 'Michael Jackson',
    album: 'Bad',
    artwork: BAD_COVER,
    duration: '5:18',
    rawDuration: 318,
    previewUrl: 'https://archive.org/download/HeeHeee..../07-Man%20in%20the%20Mirror%20%5B2012%20Remaster%5D.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/HeeHeee..../07-Man%20in%20the%20Mirror%20%5B2012%20Remaster%5D.mp3'),
    isFullLength: true,
    lyrics: [
      "I'm gonna make a change",
      "For once in my life",
      "It's gonna feel real good",
      "Gonna make a difference",
      "Gonna make it right",
      "I'm starting with the man in the mirror",
      "I'm asking him to change his ways",
      "And no message could've been any clearer",
      "If you wanna make the world a better place",
      "Take a look at yourself and then make a change"
    ]
  },
  {
    id: 'mj-dirty-diana',
    title: 'Dirty Diana',
    artist: 'Michael Jackson',
    album: 'Bad',
    artwork: BAD_COVER,
    duration: '4:40',
    rawDuration: 280,
    previewUrl: 'https://archive.org/download/HeeHeee..../09-Dirty%20Diana%20%5B2012%20Remaster%5D.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/HeeHeee..../09-Dirty%20Diana%20%5B2012%20Remaster%5D.mp3'),
    isFullLength: true,
    lyrics: [
      "Oh no, oh no, oh no",
      "You'll never make me stay",
      "So take your weight off of me",
      "I know your every move",
      "So won't you just let me be",
      "Dirty Diana, nah",
      "Dirty Diana, nah",
      "Dirty Diana, no",
      "She's saying that's okay, hey"
    ]
  }
];

export const MJ_DANGEROUS_TRACKS: TrackItem[] = [
  {
    id: 'mj-black-or-white',
    title: 'Black or White',
    artist: 'Michael Jackson',
    album: 'Dangerous',
    artwork: DANGEROUS_COVER,
    duration: '4:16',
    rawDuration: 256,
    previewUrl: 'https://archive.org/download/dangerous-michael-jackson-1991-hi-res-audio/04.%20Dangerous/08.%20Black%20or%20White.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/dangerous-michael-jackson-1991-hi-res-audio/04.%20Dangerous/08.%20Black%20or%20White.mp3'),
    isFullLength: true,
    lyrics: [
      "I took my baby on a Saturday bang",
      "Boy, is that girl with you? Yes, we're one and the same",
      "Now I believe in miracles",
      "And a miracle has happened tonight",
      "But if you're thinkin' about my baby",
      "It don't matter if you're black or white"
    ]
  },
  {
    id: 'mj-remember-the-time',
    title: 'Remember the Time',
    artist: 'Michael Jackson',
    album: 'Dangerous',
    artwork: DANGEROUS_COVER,
    duration: '4:00',
    rawDuration: 240,
    previewUrl: 'https://archive.org/download/dangerous-michael-jackson-1991-hi-res-audio/04.%20Dangerous/05.%20Remember%20the%20Time.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/dangerous-michael-jackson-1991-hi-res-audio/04.%20Dangerous/05.%20Remember%20the%20Time.mp3'),
    isFullLength: true,
    lyrics: [
      "Do you remember when we fell in love?",
      "We were so young and innocent then",
      "Do you remember how it all began?",
      "It just seemed like heaven so why did it end?",
      "Do you remember the time when we fell in love?"
    ]
  },
  {
    id: 'mj-heal-the-world',
    title: 'Heal the World',
    artist: 'Michael Jackson',
    album: 'Dangerous',
    artwork: DANGEROUS_COVER,
    duration: '6:25',
    rawDuration: 385,
    previewUrl: 'https://archive.org/download/dangerous-michael-jackson-1991-hi-res-audio/04.%20Dangerous/07.%20Heal%20the%20World.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/dangerous-michael-jackson-1991-hi-res-audio/04.%20Dangerous/07.%20Heal%20the%20World.mp3'),
    isFullLength: true,
    lyrics: [
      "Heal the world, make it a better place",
      "For you and for me and the entire human race",
      "There are people dying, if you care enough for the living",
      "Make a better place for you and for me"
    ]
  }
];

export const MJ_ALBUM_THRILLER: AlbumItem = {
  id: 'album-thriller',
  title: 'Thriller (Special Edition)',
  artist: 'Michael Jackson',
  artwork: THRILLER_COVER,
  year: '1982',
  tracksCount: MJ_THRILLER_TRACKS.length,
  totalDuration: '42 min',
  tracks: MJ_THRILLER_TRACKS
};

export const MJ_ALBUM_BAD: AlbumItem = {
  id: 'album-bad',
  title: 'Bad (2012 Remaster)',
  artist: 'Michael Jackson',
  artwork: BAD_COVER,
  year: '1987',
  tracksCount: MJ_BAD_TRACKS.length,
  totalDuration: '48 min',
  tracks: MJ_BAD_TRACKS
};

export const MJ_ALBUM_DANGEROUS: AlbumItem = {
  id: 'album-dangerous',
  title: 'Dangerous (Original Studio Master)',
  artist: 'Michael Jackson',
  artwork: DANGEROUS_COVER,
  year: '1991',
  tracksCount: MJ_DANGEROUS_TRACKS.length,
  totalDuration: '77 min',
  tracks: MJ_DANGEROUS_TRACKS
};

export const MICHAEL_JACKSON_ARTIST: ArtistItem = {
  id: 'artist-michael-jackson',
  name: 'Michael Jackson',
  avatar: MJ_AVATAR,
  genre: 'Pop / R&B / Soul',
  followers: '48.9M',
  popularTracks: [
    MJ_THRILLER_TRACKS[0], // Billie Jean
    MJ_THRILLER_TRACKS[1], // Beat It
    MJ_THRILLER_TRACKS[2], // Thriller
    MJ_BAD_TRACKS[0],      // Smooth Criminal
    MJ_BAD_TRACKS[1],      // Bad
    MJ_BAD_TRACKS[2],      // The Way You Make Me Feel
    MJ_BAD_TRACKS[3],      // Man in the Mirror
    MJ_DANGEROUS_TRACKS[0], // Black or White
    MJ_DANGEROUS_TRACKS[1], // Remember the Time
    MJ_THRILLER_TRACKS[4], // Human Nature
    MJ_BAD_TRACKS[4],      // Dirty Diana
  ],
  albums: [
    MJ_ALBUM_THRILLER,
    MJ_ALBUM_BAD,
    MJ_ALBUM_DANGEROUS
  ]
};

// -------------------------------------------------------------
// OFFICIAL ARTIST: QUEEN
// -------------------------------------------------------------
const QUEEN_AVATAR = 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80';
const QUEEN_OPERA_COVER = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80';

export const QUEEN_TRACKS: TrackItem[] = [
  {
    id: 'queen-bohemian-rhapsody',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    artwork: QUEEN_OPERA_COVER,
    duration: '5:55',
    rawDuration: 355,
    previewUrl: 'https://archive.org/download/pckt-vinyl-queen-a-night-at-the-opera/a-night-at-the-opera.mp3',
    streamUrl: '/api/music/stream?url=' + encodeURIComponent('https://archive.org/download/pckt-vinyl-queen-a-night-at-the-opera/a-night-at-the-opera.mp3'),
    isFullLength: true,
    lyrics: [
      "Is this the real life? Is this just fantasy?",
      "Caught in a landslide, no escape from reality",
      "Open your eyes, look up to the skies and see",
      "I'm just a poor boy, I need no sympathy",
      "Because I'm easy come, easy go, little high, little low",
      "Any way the wind blows doesn't really matter to me, to me",
      "Mama, just killed a man",
      "Put a gun against his head, pulled my trigger, now he's dead",
      "Mama, life had just begun",
      "But now I've gone and thrown it all away"
    ]
  }
];

export const QUEEN_ALBUM: AlbumItem = {
  id: 'album-queen-opera',
  title: 'A Night at the Opera',
  artist: 'Queen',
  artwork: QUEEN_OPERA_COVER,
  year: '1975',
  tracksCount: 12,
  totalDuration: '43 min',
  tracks: QUEEN_TRACKS
};

export const QUEEN_ARTIST: ArtistItem = {
  id: 'artist-queen',
  name: 'Queen',
  avatar: QUEEN_AVATAR,
  genre: 'Classic Rock',
  followers: '36.2M',
  popularTracks: QUEEN_TRACKS,
  albums: [QUEEN_ALBUM]
};

// -------------------------------------------------------------
// EXISTING TESTAMENT CATALOG (Retained for tests and screenshots)
// -------------------------------------------------------------
const VERIFIED_STREAMS = [
  'https://discoveryprovider.audius.co/v1/tracks/vZJJz/stream?app_name=FROSTED_APP',
  'https://discoveryprovider.audius.co/v1/tracks/J72oWO6/stream?app_name=FROSTED_APP',
  'https://discoveryprovider.audius.co/v1/tracks/RRxymAw/stream?app_name=FROSTED_APP',
  'https://discoveryprovider.audius.co/v1/tracks/dEdg4/stream?app_name=FROSTED_APP',
  'https://discoveryprovider.audius.co/v1/tracks/pjQxqQ0/stream?app_name=FROSTED_APP',
  'https://discoveryprovider.audius.co/v1/tracks/GYj7aNj/stream?app_name=FROSTED_APP',
  'https://discoveryprovider.audius.co/v1/tracks/44G3vWj/stream?app_name=FROSTED_APP',
];

export const TESTAMENT_ARTIST: ArtistItem = {
  id: 'artist-testament',
  name: 'Testament',
  avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
  genre: 'Thrash Metal',
  followers: '1.2M',
  popularTracks: [
    {
      id: 'testament-1',
      title: 'Brotherhood of the Snake',
      artist: 'Testament',
      album: 'Brotherhood of the Snake',
      artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      duration: '4:14',
      rawDuration: 254,
      previewUrl: VERIFIED_STREAMS[0],
      isFullLength: true,
      lyrics: [
        "In the eyes of the serpentine",
        "Ancient bloodlines intertwine",
        "Secrets buried deep within",
        "Where the serpent kings begin"
      ]
    },
    {
      id: 'testament-2',
      title: 'Return to Serenity',
      artist: 'Testament',
      album: 'The Ritual',
      artwork: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
      duration: '6:31',
      rawDuration: 391,
      previewUrl: VERIFIED_STREAMS[1],
      isFullLength: true
    },
    {
      id: 'testament-3',
      title: 'Electric Crown',
      artist: 'Testament',
      album: 'The Ritual',
      artwork: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
      duration: '5:31',
      rawDuration: 331,
      previewUrl: VERIFIED_STREAMS[2],
      isFullLength: true
    }
  ],
  albums: [
    {
      id: 'album-para-bellum',
      title: 'Para Bellum',
      artist: 'Testament',
      artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      year: '2020',
      tracksCount: 10,
      totalDuration: '47 min',
      tracks: [
        {
          id: 'pb-1',
          title: 'Children of the Next Level',
          artist: 'Testament',
          album: 'Para Bellum',
          artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          duration: '6:13',
          rawDuration: 373,
          previewUrl: VERIFIED_STREAMS[0],
          isFullLength: true
        },
        {
          id: 'pb-2',
          title: 'WWIII',
          artist: 'Testament',
          album: 'Para Bellum',
          artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          duration: '4:48',
          rawDuration: 288,
          previewUrl: VERIFIED_STREAMS[1],
          isFullLength: true
        }
      ]
    }
  ]
};

// -------------------------------------------------------------
// GLOBAL CATALOG OF VERIFIED OFFICIAL ARTISTS & ALBUMS
// -------------------------------------------------------------
export const ALL_OFFICIAL_ARTISTS: ArtistItem[] = [
  MICHAEL_JACKSON_ARTIST,
  QUEEN_ARTIST,
  TESTAMENT_ARTIST
];

export const ALL_OFFICIAL_ALBUMS: AlbumItem[] = [
  MJ_ALBUM_THRILLER,
  MJ_ALBUM_BAD,
  MJ_ALBUM_DANGEROUS,
  QUEEN_ALBUM,
  TESTAMENT_ARTIST.albums[0]
];

export const ALL_OFFICIAL_TRACKS: TrackItem[] = [
  ...MJ_THRILLER_TRACKS,
  ...MJ_BAD_TRACKS,
  ...MJ_DANGEROUS_TRACKS,
  ...QUEEN_TRACKS,
  ...TESTAMENT_ARTIST.popularTracks
];

// Compatibility exports
export const SEARCH_ARTISTS_TEST: ArtistItem[] = [
  TESTAMENT_ARTIST,
  MICHAEL_JACKSON_ARTIST,
  QUEEN_ARTIST
];

export const SEARCH_ALBUMS_TESTAMENT: AlbumItem[] = [
  TESTAMENT_ARTIST.albums[0],
  MJ_ALBUM_THRILLER,
  MJ_ALBUM_BAD
];

export const TEST_TRACKS: TrackItem[] = ALL_OFFICIAL_TRACKS.slice(0, 8);

export const PARA_BELLUM_ALBUM: AlbumItem = TESTAMENT_ARTIST.albums[0];

export const PROVIDERS = [
  { id: 'x8rr', name: 'x8rr (Cherri Official)', latency: '1ms' },
  { id: 'ytm', name: 'YouTube Music', latency: '1ms' },
  { id: 'tidal', name: 'Tidal', latency: '4ms' },
  { id: 'soundcloud', name: 'SoundCloud', latency: '1ms' },
  { id: 'audius', name: 'Audius', latency: '8ms' },
];

/**
 * Smart lookup function to search local verified official catalog
 */
export function searchOfficialCatalog(query: string): {
  artists: ArtistItem[];
  albums: AlbumItem[];
  tracks: TrackItem[];
} {
  const q = query.toLowerCase().trim();
  if (!q) {
    return {
      artists: ALL_OFFICIAL_ARTISTS,
      albums: ALL_OFFICIAL_ALBUMS,
      tracks: ALL_OFFICIAL_TRACKS
    };
  }

  const artists = ALL_OFFICIAL_ARTISTS.filter(a => 
    a.name.toLowerCase().includes(q) || a.genre?.toLowerCase().includes(q)
  );

  const albums = ALL_OFFICIAL_ALBUMS.filter(al => 
    al.title.toLowerCase().includes(q) || al.artist.toLowerCase().includes(q)
  );

  const tracks = ALL_OFFICIAL_TRACKS.filter(t => 
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    t.album.toLowerCase().includes(q)
  );

  return { artists, albums, tracks };
}
