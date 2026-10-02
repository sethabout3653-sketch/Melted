export interface ChatMessage {
  id: string;
  sender: string;
  avatarColor: string;
  avatarText: string;
  timestamp: string;
  content: string;
  isSelf?: boolean;
}

export interface VoiceParticipant {
  id: string;
  name: string;
  avatarColor: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened?: boolean;
  isSelf?: boolean;
}
