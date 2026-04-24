import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { Groq } from 'groq-sdk';
import { BotConfig } from './types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function generateResponse(config: BotConfig, messages: ChatMessage[]): Promise<string> {
  const p = config.provider.toLowerCase();
  
  // Safely fallback models that are dead/fake/removed
  let targetModel = config.model || 'gemini-2.5-flash';
  if (targetModel.includes('gemma-4')) {
    targetModel = targetModel.replace('gemma-4', 'gemma-3');
  }

  // Extract system messages natively to prevent models from thinking it's a user chat message
  const systemPrompts = messages.filter(m => m.role === 'system').map(m => m.content).join('\\n');
  const chatMessages = messages.filter(m => m.role !== 'system');

  try {
    if (p === 'google') {
      const ai = new GoogleGenAI({ apiKey: config.api_key });
      
      // Google requires strict role formatting and doesn't tolerate two 'user' messages in a row well.
      let history: any[] = [];
      for (let m of chatMessages.slice(0, -1)) {
        const r = m.role === 'assistant' ? 'model' : 'user';
        if (history.length > 0 && history[history.length - 1].role === r) {
          history[history.length - 1].parts[0].text += `\\n${m.content}`;
        } else {
          history.push({ role: r, parts: [{ text: m.content }] });
        }
      }
      
      const lastMsg = chatMessages[chatMessages.length - 1].content;
      if (history.length > 0 && history[history.length - 1].role === 'user') {
        history[history.length - 1].parts[0].text += `\\n${lastMsg}`;
      } else {
        history.push({ role: 'user', parts: [{ text: lastMsg }] });
      }

      const params: any = {
        model: targetModel,
        contents: history,
      };

      if (systemPrompts) {
        params.systemInstruction = { role: 'system', parts: [{ text: systemPrompts }] };
      }

      try {
         const response = await ai.models.generateContent(params);
         return response.text || 'No response generated.';
      } catch (genErr: any) {
         if (genErr.message?.includes('503') || genErr.message?.includes('high demand') || genErr.status === 503) {
            // Hot fallback if Google AI fails via overload; force use of standard gemini fallback 
            console.log("Caught 503. Executing fallback logic");
            params.model = 'gemini-2.0-flash'; // Always safe bet
            const fallbackAi = new GoogleGenAI({ apiKey: config.api_key });
            const fallbackResponse = await fallbackAi.models.generateContent(params);
            return fallbackResponse.text || 'No response generated.';
         }
         throw genErr;
      }
    }

    if (p === 'openai' || p === 'openrouter') {
      const isOR = p === 'openrouter';
      const openai = new OpenAI({
        apiKey: config.api_key,
        baseURL: isOR ? 'https://openrouter.ai/api/v1' : undefined,
        defaultHeaders: isOR ? {
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Nexus AI Dashboard'
        } : undefined
      });

      const response = await openai.chat.completions.create({
        model: targetModel || (isOR ? 'google/gemini-2.5-flash' : 'gpt-4o-mini'),
        messages: messages as any,
      });
      return response.choices[0]?.message?.content || 'No response generated.';
    }

    if (p === 'groq') {
      const groq = new Groq({ apiKey: config.api_key });
      const response = await groq.chat.completions.create({
        model: targetModel || 'llama3-8b-8192',
        messages: messages as any,
      });
      return response.choices[0]?.message?.content || 'No response generated.';
    }

    return 'Provider not supported.';
  } catch (err: any) {
    console.error('AI generation error:', err);
    return `Error: ${err.message}`;
  }
}
