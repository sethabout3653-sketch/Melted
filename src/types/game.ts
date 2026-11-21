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

export type EsrbRatingCode = 'E' | 'E10+' | 'T' | 'M' | 'AO';

export interface GameRatingInfo {
  code: EsrbRatingCode;
  label: string;
  age: string;
  descriptors?: string;
  requiresGate: boolean;
  gateMinAge?: '13+' | '17+' | '18+';
  specialTags: string[];
  coverTag?: string;
  warningMessage?: string;
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

