'use client';

import { useState } from 'react';
import { BotConfig } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export function BotTab({ bot, onUpdate, onDelete }: { bot: BotConfig, onUpdate: () => void, onDelete: () => void }) {
  const [formData, setFormData] = useState({ ...bot });
  const [showToken, setShowToken] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const status = (bot as any).status || 'offline';
  const isOnline = status === 'online';

  const MODELS: Record<string, string[]> = {
    'Google': [
      'gemini-2.5-flash', 
      'gemini-2.5-pro', 
      'gemini-2.0-flash', 
      'gemma-2-2b-it',
      'gemma-2-9b-it',
      'gemma-2-27b-it',
      'gemma-3-4b-it',
      'gemma-3-12b-it',
      'gemma-3-27b-it'
    ],
    'OpenAI': ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
    'Groq': ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    'OpenRouter': [
      'anthropic/claude-3.5-sonnet', 
      'meta-llama/llama-3-8b-instruct', 
      'deepseek/deepseek-chat', 
      'google/gemma-2-9b-it', 
      'google/gemma-2-27b-it',
      'google/gemma-3-4b-it',
      'google/gemma-3-12b-it',
      'google/gemma-3-27b-it'
    ]
  };

  const TTS_PROVIDERS = ['EdgeTTS', 'OpenAI', 'Deepgram'];

  const TTS_VOICES_MAP: Record<string, {id: string, name: string}[]> = {
    'EdgeTTS': [
      { id: 'en-US-AriaNeural', name: 'Aria (Female, US)' },
      { id: 'en-US-GuyNeural', name: 'Guy (Male, US)' },
      { id: 'en-GB-SoniaNeural', name: 'Sonia (Female, UK)' },
      { id: 'en-AU-NatashaNeural', name: 'Natasha (Female, AU)' }
    ],
    'OpenAI': [
      { id: 'alloy', name: 'Alloy (Neutral)' },
      { id: 'echo', name: 'Echo (Male)' },
      { id: 'fable', name: 'Fable (British Male)' },
      { id: 'onyx', name: 'Onyx (Deep Male)' },
      { id: 'nova', name: 'Nova (Female)' },
      { id: 'shimmer', name: 'Shimmer (Bright Female)' }
    ],
    'Deepgram': [
      { id: 'aura-asteria-en', name: 'Asteria (Female, US)' },
      { id: 'aura-luna-en', name: 'Luna (Female, US)' },
      { id: 'aura-stella-en', name: 'Stella (Female, US)' },
      { id: 'aura-hera-en', name: 'Hera (Female, US)' },
      { id: 'aura-orion-en', name: 'Orion (Male, US)' },
      { id: 'aura-arcas-en', name: 'Arcas (Male, US)' },
      { id: 'aura-perseus-en', name: 'Perseus (Male, US)' },
      { id: 'aura-angus-en', name: 'Angus (Male, IE)' },
      { id: 'aura-orpheus-en', name: 'Orpheus (Male, US)' },
      { id: 'aura-helios-en', name: 'Helios (Male, UK)' },
      { id: 'aura-zeus-en', name: 'Zeus (Male, US)' }
    ]
  };

  const currentModels = MODELS[formData.provider] || MODELS['Google'];
  const currentTtsVoices = TTS_VOICES_MAP[formData.tts_provider || 'EdgeTTS'] || TTS_VOICES_MAP['EdgeTTS'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => {
      const next = { ...prev, [e.target.name]: e.target.value };
      if (e.target.name === 'provider') {
        next.model = MODELS[e.target.value]?.[0] || 'gemini-2.5-flash';
      }
      if (e.target.name === 'tts_provider') {
        next.tts_voice = TTS_VOICES_MAP[e.target.value]?.[0]?.id || 'en-US-AriaNeural';
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    await fetch(`/api/bots/${bot.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setSaving(false);
    onUpdate();
  };

  const toggleStatus = async () => {
    setToggling(true);
    const endpoint = isOnline ? `/api/bots/${bot.id}/stop` : `/api/bots/${bot.id}/start`;
    await fetch(endpoint, { method: 'POST' });
    setToggling(false);
    onUpdate();
  };

  return (
    <>
      <div className="flex flex-col xl:flex-row justify-between items-start gap-6">
        <div className="flex-1 w-full space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block uppercase tracking-wider">Bot Designation</label>
            <input 
              name="name" value={formData.name} onChange={handleChange} 
              className="bg-transparent text-2xl font-bold border-b border-transparent hover:border-zinc-800 focus:border-zinc-400 p-0 text-zinc-100 w-full transition-colors outline-none pb-1" 
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 block uppercase tracking-wider mb-2">Discord Access Token</label>
            <div className="flex gap-2">
              <input 
                 name="discord_token" type={showToken ? "text" : "password"} value={formData.discord_token} onChange={handleChange} 
                 className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-300 flex-1 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all placeholder:text-zinc-700" 
                 placeholder="MTA..."
              />
              <button 
                onClick={() => setShowToken(!showToken)}
                className="text-xs px-4 font-medium bg-zinc-800 rounded-md hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="text-left xl:text-right shrink-0 w-full xl:w-auto">
          <button 
            onClick={toggleStatus} disabled={toggling}
            className={`px-6 py-2.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 w-full xl:w-auto transition-colors ${isOnline ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'}`}
          >
            {toggling && <Loader2 className="w-4 h-4 animate-spin" />}
            {isOnline ? 'Stop Instance' : 'Start Instance'}
          </button>
          <div className="flex items-center gap-2 mt-3 xl:justify-end">
             <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
             <p className="text-xs font-medium text-zinc-400">
               {isOnline ? 'Connected to Gateway' : 'Offline'}
             </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">AI Intelligence Provider</label>
          <select 
            name="provider" value={formData.provider} onChange={handleChange}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
          >
            <option value="Google">Google Generative AI</option>
            <option value="OpenAI">OpenAI</option>
            <option value="Groq">Groq AI</option>
            <option value="OpenRouter">OpenRouter</option>
          </select>
        </div>
        <div className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Active Neural Model</label>
          <select 
            name="model" value={formData.model} onChange={handleChange} 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
          >
            {currentModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
           <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Provider API Key</label>
           <div className="flex gap-2">
              <input 
                 name="api_key" type={showKey ? "text" : "password"} value={formData.api_key} onChange={handleChange} 
                 className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 flex-1 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors" 
                 placeholder="Enter API Key..."
              />
              <button 
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-2"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
           </div>
        </div>

        <div className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">TTS Provider</label>
          <select 
            name="tts_provider" value={formData.tts_provider || 'EdgeTTS'} onChange={handleChange} 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
          >
            {TTS_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="mt-3 text-[10px] text-zinc-500 font-mono space-y-1">
            {(!formData.tts_provider || formData.tts_provider === 'EdgeTTS') && (
              <p className="text-emerald-500/70">EdgeTTS: 100% Free • Unlimited • Reverse-Engineered Endpoint</p>
            )}
            {formData.tts_provider === 'Deepgram' && (
              <p className="text-amber-500/70">Deepgram: External API Limits Apply • ~$0.0150/10K characters</p>
            )}
            {formData.tts_provider === 'OpenAI' && (
              <p className="text-amber-500/70">OpenAI (HD): External API Limits Apply • ~$0.030/1K characters</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
           <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">TTS API Key</label>
           <div className="flex gap-2">
              <input 
                 name="tts_api_key" type={showKey ? "text" : "password"} value={formData.tts_api_key || ''} onChange={handleChange} 
                 className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 flex-1 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors" 
                 placeholder={formData.tts_provider === 'EdgeTTS' ? 'Not Required' : 'Enter TTS API Key...'}
                 disabled={formData.tts_provider === 'EdgeTTS'}
              />
           </div>
        </div>

        <div className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">TTS Voice</label>
          <select 
            name="tts_voice" value={formData.tts_voice || 'en-US-AriaNeural'} onChange={handleChange} 
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
          >
            {currentTtsVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div className="bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-4">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-2">Custom System Instructions (Optional)</label>
          <textarea 
            name="system_prompt" 
            value={formData.system_prompt || ''} 
            onChange={(e) => handleChange(e as any)}
            placeholder="e.g. You are a pirate bot. Always speak in sea shanties..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors min-h-[80px] custom-scrollbar"
          />
        </div>
        <div className="flex justify-between items-center bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-4">
          <div className="flex-1 mr-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Context Memory Buffer</label>
              <span className="text-xs font-semibold text-zinc-200">{formData.context_size} Messages</span>
            </div>
            <input 
              name="context_size" type="range" min="1" max="50" value={formData.context_size} onChange={handleChange}
              className="w-full accent-zinc-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
            />
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col sm:flex-row gap-3 pt-6 border-t border-zinc-800/80">
        <button 
          onClick={save} disabled={saving}
          className="flex-[2] py-2.5 bg-zinc-100 text-zinc-900 rounded-md text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save System Configuration
        </button>
        <button 
          onClick={onDelete}
          className="flex-1 py-2.5 bg-transparent border border-rose-900/50 text-rose-500 rounded-md text-sm font-semibold hover:bg-rose-950/30 hover:border-rose-800 transition-colors"
        >
           Delete Bot
        </button>
      </div>
    </>
  );
}
