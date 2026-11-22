import { GameRatingInfo } from '../types/game';

export type { GameRatingInfo };

export function resolveGameRating(name: string, special?: string[], category?: string): GameRatingInfo {
  const lower = (name + ' ' + (category || '') + ' ' + (special || []).join(' ')).toLowerCase();
  
  if (lower.includes('horror') || lower.includes('resident') || lower.includes('zombie') || lower.includes('evil') || lower.includes('fnaf') || lower.includes('five nights')) {
    return {
      code: 'M',
      label: 'Mature 17+',
      age: '17+',
      descriptors: 'Blood, Horror, Violence',
      requiresGate: true,
      coverTag: '17+',
      specialTags: ['Horror']
    };
  }
  if (lower.includes('mature') || lower.includes('18+') || lower.includes('hentai') || lower.includes('adult') || lower.includes('nsfw')) {
    return {
      code: 'AO',
      label: 'Adults Only 18+',
      age: '18+',
      descriptors: 'Adult Content',
      requiresGate: true,
      coverTag: '18+',
      specialTags: ['Adult']
    };
  }
  if (lower.includes('action') || lower.includes('shooter') || lower.includes('fight') || lower.includes('combat') || lower.includes('gun') || lower.includes('bullet') || lower.includes('war')) {
    return {
      code: 'T',
      label: 'Teen',
      age: '13+',
      descriptors: 'Violence',
      requiresGate: false,
      coverTag: '13+',
      specialTags: ['Action']
    };
  }
  return {
    code: 'E',
    label: 'Everyone',
    age: '3+',
    descriptors: 'General',
    requiresGate: false,
    specialTags: []
  };
}
