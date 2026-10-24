// LLMConfig → Vercel AI SDK 모델 (별칭 보강, 약관 추출에서 공유)
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { LLMConfig } from './llm-config.ts';

export function createLanguageModel({ provider, model, apiKey, baseURL }: LLMConfig): LanguageModel {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL })(model);
    case 'openai':
      return createOpenAI({ apiKey, baseURL })(model);
    case 'openai-compatible':
      if (!baseURL) throw new Error('openai-compatible 공급사에는 baseURL이 필요합니다.');
      return createOpenAICompatible({ name: 'openai-compatible', apiKey, baseURL })(model);
  }
}
