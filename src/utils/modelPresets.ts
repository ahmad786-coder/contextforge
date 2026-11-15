import type { ModelPreset } from '../types';

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'claude-sonnet',
    name: 'Claude 4.6 / Sonnet',
    provider: 'Anthropic',
    maxTokens: 200_000,
    badge: '200k',
  },
  {
    id: 'gpt-5-o3',
    name: 'GPT-5 / o3',
    provider: 'OpenAI',
    maxTokens: 128_000,
    badge: '128k',
  },
  {
    id: 'gemini-flash',
    name: 'Gemini 4 / 3.8',
    provider: 'Google',
    maxTokens: 1_000_000,
    badge: '1,000k',
  },
  {
    id: 'local-llm',
    name: 'Local LLM / Small',
    provider: 'Ollama / vLLM',
    maxTokens: 32_000,
    badge: '32k',
  },
];
