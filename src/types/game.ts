export interface RawGame {
  id: number;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  special?: string[];
  featured?: boolean;
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

export interface GameItem extends RawGame {
  category: GameCategory;
  resolvedCover: string;
  resolvedUrl: string;
}

export interface TabCloakPreset {
  id: string;
  name: string;
  title: string;
  icon: string;
}
