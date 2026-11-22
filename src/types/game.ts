export interface RawGame {
  id: number;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  fallbackCover?: string;
  localCover?: string;
  special?: string[];
  featured?: boolean;
  source?: 'native' | 'ugs' | 'CKV' | 'scramjet';
}

export type GameCategory = 
  | 'All'
  | 'Featured'
  | 'Action & Shooters'
  | 'Driving & Racing'
  | 'Skill & Platformer'
  | 'Retro & Arcade'
  | 'Horror & Mystery'
  | 'Sports & Physics'
  | 'Puzzle & Casual'
  | 'Emulators & Ports'
  | 'Favorites';

export type EsrbRatingCode = 'E' | 'E10+' | 'T' | 'M' | 'AO' | 'RP';

export interface GameRatingInfo {
  code: EsrbRatingCode;
  label: string;
  age?: string;
  descriptors?: string;
  interactiveElements?: string;
  synopsis?: string;
  esrbTitle?: string;
  esrbUrl?: string;
  badgePath: string;
  badgeUrl: string;
  officialBadgeUrl: string;
  requiresGate: boolean;
  gateMinAge?: '17+' | '18+';
  specialTags: string[];
  coverTag?: string;
  warningMessage?: string;
  source: 'esrb';
}

export interface GameItem extends RawGame {
  category: GameCategory;
  resolvedCover: string;
  fallbackCover: string;
  localCover: string;
  resolvedUrl: string;
  proxyUrl?: string;
  rating?: GameRatingInfo;
}

export interface TabCloakPreset {
  id: string;
  name: string;
  title: string;
  icon: string;
}

