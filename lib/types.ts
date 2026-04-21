export interface BotConfig {
  id: string;
  name: string;
  discord_token: string;
  provider: string; // 'Google' | 'OpenAI' | 'Groq' | 'OpenRouter'
  model: string;
  api_key: string;
  context_size: number;
  tts_provider?: string; // 'EdgeTTS' | 'OpenAI' | 'Deepgram'
  tts_voice?: string;
  tts_api_key?: string;
  system_prompt?: string;
}

export interface RedeemKey {
  id: string;
  key_string: string;
  rpm: number;
  rpd: number;
  max_tokens: number;
  label: string;
}

export interface ServerKeyUsage {
  key_id: string;
  server_id: string;
  rpm_used: number;
  rpd_used: number;
  tokens_used: number;
  last_rpm_reset: number;
  last_rpd_reset: number;
}
