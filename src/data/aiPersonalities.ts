export type AIPersonalityId = 'zephyr' | 'puck' | 'charon' | 'kore' | 'fenrir';

export interface AIPersonality {
  id: AIPersonalityId;
  label: string;
  description: string;
}

export const AI_PERSONALITIES: AIPersonality[] = [
  { id: 'zephyr', label: 'Zephyr', description: 'Helpful and balanced assistant' },
  { id: 'puck', label: 'Puck', description: 'Creative and witty' },
  { id: 'charon', label: 'Charon', description: 'Direct and concise' },
  { id: 'kore', label: 'Kore', description: 'Warm and friendly' },
  { id: 'fenrir', label: 'Fenrir', description: 'Technical and analytical' },
];

export const DEFAULT_AI_PERSONALITY: AIPersonalityId = 'zephyr';

export function isAIPersonalityId(val: string): val is AIPersonalityId {
  return AI_PERSONALITIES.some((p) => p.id === val);
}

export function buildAISystemInstruction(_personality?: unknown): string {
  return 'You are a helpful, accurate, and concise AI assistant powered by OpenRouter.';
}
