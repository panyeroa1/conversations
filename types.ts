export interface Language {
  code: string;
  label: string;
}

export interface TranscriptPayload {
  client_id: string;
  source_text: string;
  source_lang_code: string;
  updated_at: string;
}

export enum AudioSource {
  MIC = 'mic',
  SCREEN = 'screen',
  TAB = 'tab'
}

export enum Tab {
  BROADCASTER = 'broadcaster',
  TRANSLATOR = 'translator'
}

export interface Message {
  id: string;
  text: string;
  timestamp: number;
  isTranslation?: boolean;
}