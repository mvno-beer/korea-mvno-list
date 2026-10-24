// 테스트용 AI SDK mock 모델 응답
import type { MockLanguageModelV4 } from 'ai/test';

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

export const generateResult = (text: string): GenerateResult => ({
  content: [{ type: 'text', text }],
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
  warnings: [],
});
