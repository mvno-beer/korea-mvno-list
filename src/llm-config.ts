// 에이전트용(AGENT_LLM_*)과 별칭용(ALIAS_LLM_*) LLM 연결 설정.
// LLM 관련 환경변수는 이 파일에서만 읽는다. 에러와 로그에 API 키 값을 넣지 않는다.

export const PROVIDERS = ['anthropic', 'openai', 'openai-compatible'] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface LLMConfig {
  provider: Provider;
  model: string;
  apiKey: string;
  baseURL: string | undefined;
}

type Env = Record<string, string | undefined>;

// 기본 모델은 기본 공급사(anthropic)에만 적용한다. 다른 공급사에 Claude 모델명이 넘어가지 않게 한다.
const DEFAULT_PROVIDER: Provider = 'anthropic';
const DEFAULT_MODELS: Partial<Record<Provider, string>> = { anthropic: 'claude-opus-5-5' };

// 구 키 → 대응하는 새 키
const LEGACY_KEYS: Record<string, string> = {
  ANTHROPIC_API_KEY: 'AGENT_LLM_API_KEY',
  LLM_MODEL: 'AGENT_LLM_MODEL',
  ALIAS_MODEL: 'ALIAS_LLM_MODEL',
};

export class LLMConfigError extends Error {
  name = 'LLMConfigError';
}

// GitHub Actions에서 비어 있는 variable은 빈 문자열로 넘어오므로 미설정으로 본다.
function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function isProvider(value: string | undefined): value is Provider {
  return (PROVIDERS as readonly (string | undefined)[]).includes(value);
}

function checkLegacyKeys(env: Env): void {
  const stale = Object.entries(LEGACY_KEYS).filter(
    ([oldKey, newKey]) => read(env, oldKey) && !read(env, newKey),
  );
  if (stale.length) {
    throw new LLMConfigError(
      '더 이상 쓰지 않는 환경변수가 설정되어 있습니다. 새 키로 옮기세요:\n' +
        stale.map(([oldKey, newKey]) => `  ${oldKey} → ${newKey}`).join('\n'),
    );
  }
}

function readGroup(
  env: Env,
  prefix: string,
  { defaultProvider }: { defaultProvider: Provider | undefined },
): LLMConfig {
  const providerKey = `${prefix}PROVIDER`;
  const provider = read(env, providerKey) ?? defaultProvider;
  if (!isProvider(provider)) {
    throw new LLMConfigError(
      `${providerKey} 값이 올바르지 않습니다: "${provider}" (가능한 값: ${PROVIDERS.join(', ')})`,
    );
  }

  const model = read(env, `${prefix}MODEL`) ?? DEFAULT_MODELS[provider];
  const apiKey = read(env, `${prefix}API_KEY`);
  const baseURL = read(env, `${prefix}BASE_URL`);

  const missing: string[] = [];
  if (!model) missing.push(`${prefix}MODEL`);
  if (!apiKey) missing.push(`${prefix}API_KEY`);
  if (provider === 'openai-compatible' && !baseURL) missing.push(`${prefix}BASE_URL`);
  if (!model || !apiKey || missing.length) {
    throw new LLMConfigError(
      `${provider} 공급사에 필요한 환경변수가 없습니다: ${missing.join(', ')}`,
    );
  }
  return { provider, model, apiKey, baseURL };
}

export function getAgentLLMConfig(env: Env = process.env): LLMConfig {
  checkLegacyKeys(env);
  return readGroup(env, 'AGENT_LLM_', { defaultProvider: DEFAULT_PROVIDER });
}

// ALIAS_LLM_PROVIDER가 없으면 네 값을 모두 에이전트 설정에서 가져온다.
// 지정되면 ALIAS_LLM_*만 쓴다. (다른 공급사의 키나 base URL이 섞이지 않게)
export function getAliasLLMConfig(env: Env = process.env): LLMConfig {
  checkLegacyKeys(env);
  if (!read(env, 'ALIAS_LLM_PROVIDER')) return getAgentLLMConfig(env);
  return readGroup(env, 'ALIAS_LLM_', { defaultProvider: undefined });
}

// 진입점용: 설정이 잘못되면 메시지만 출력하고 종료한다.
export function loadLLMConfigOrExit<T>(load: () => T): T {
  try {
    return load();
  } catch (err) {
    if (!(err instanceof LLMConfigError)) throw err;
    console.error(err.message);
    process.exit(1);
  }
}
