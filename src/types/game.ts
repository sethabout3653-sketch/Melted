export interface RawGame {
  id: number;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  special?: string[];
  featured?: boolean;
  source?: 'native' | 'lumin';
  luminId?: string;
}

export type GameCategory = 
  | 'All'
  | 'Featured'
  | 'Lumin Games'
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

export interface LuminGameRaw {
  id: string;
  name: string;
  image_token: string;
  category?: string;
}
