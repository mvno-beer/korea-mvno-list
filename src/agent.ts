// npm run agent: browser-use 에이전트로 통신사별 알뜰폰 약관 원문을 수집해 TERMS_PATH에 저장한다.
import { readFile } from 'node:fs/promises';
import { Agent, BrowserProfile, BrowserSession, Controller } from 'browser-use';
import { ChatAnthropic } from 'browser-use/llm/anthropic';
import { ChatOpenAI } from 'browser-use/llm/openai';
import { getAgentLLMConfig, type LLMConfig, loadLLMConfigOrExit } from './llm-config.ts';
import { MNOS } from './mvno-list.ts';
import { TERMS_PATH } from './paths.ts';
import { registerSaveTerms } from './save-terms.ts';

const START_URL =
  process.env.START_URL || 'https://sign-service.inicis.com/sample/request.php?reqSvcCd=03';
const MAX_STEPS = Number(process.env.MAX_STEPS || 60);
const PROMPT_PATH = new URL('../docs/browser-use-prompt.md', import.meta.url);

// openai와 openai-compatible은 같은 클래스에 baseURL만 다르게 넘긴다.
function createAgentLLM({ provider, model, apiKey, baseURL }: LLMConfig) {
  if (provider === 'anthropic') return new ChatAnthropic({ model, apiKey, baseURL });
  return new ChatOpenAI({ model, apiKey, baseURL });
}

const agentLLM = loadLLMConfigOrExit(getAgentLLMConfig);
console.log(`agent llm: ${agentLLM.provider} ${agentLLM.model}`);

const controller = new Controller();
const terms = registerSaveTerms(controller, { outputPath: TERMS_PATH });

const agent = new Agent({
  task: await readFile(PROMPT_PATH, 'utf8'),
  llm: createAgentLLM(agentLLM),
  controller,
  initial_actions: [{ navigate: { url: START_URL } }],
  browser_session: new BrowserSession({
    browser_profile: new BrowserProfile({ user_data_dir: null }),
  }),
  use_judge: false,
});

try {
  await agent.run(MAX_STEPS);
} finally {
  await agent.close();
}

const missing = MNOS.filter((mno) => !terms[mno]);
if (missing.length) {
  console.error(`약관을 수집하지 못한 통신사: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`wrote ${TERMS_PATH}: ${MNOS.join(', ')}`);
