import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAgentLLMConfig, getAliasLLMConfig, LLMConfigError } from '../src/llm-config.ts';

const SECRET = 'sk-test-secret-value';

test('기본값: anthropic / claude-opus-5-5', () => {
  assert.deepEqual(getAgentLLMConfig({ AGENT_LLM_API_KEY: SECRET }), {
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    apiKey: SECRET,
    baseURL: undefined,
  });
});

test('ALIAS_LLM_PROVIDER 미지정: 에이전트 설정 전체 상속', () => {
  const env = {
    AGENT_LLM_PROVIDER: 'openai-compatible',
    AGENT_LLM_MODEL: 'agent-model',
    AGENT_LLM_API_KEY: SECRET,
    AGENT_LLM_BASE_URL: 'https://agent.example/v1',
    // 공급사가 없으면 나머지 ALIAS 값은 쓰지 않는다.
    ALIAS_LLM_MODEL: 'ignored',
  };
  assert.deepEqual(getAliasLLMConfig(env), getAgentLLMConfig(env));
});

test('ALIAS_LLM_PROVIDER 지정: 상속하지 않음', () => {
  const env = {
    AGENT_LLM_API_KEY: SECRET,
    AGENT_LLM_BASE_URL: 'https://agent.example/v1',
    ALIAS_LLM_PROVIDER: 'openai-compatible',
    ALIAS_LLM_MODEL: 'Qwen/Qwen3-32B',
    ALIAS_LLM_API_KEY: 'alias-key',
    ALIAS_LLM_BASE_URL: 'https://api.siliconflow.com/v1',
  };
  assert.deepEqual(getAliasLLMConfig(env), {
    provider: 'openai-compatible',
    model: 'Qwen/Qwen3-32B',
    apiKey: 'alias-key',
    baseURL: 'https://api.siliconflow.com/v1',
  });
  assert.equal(getAgentLLMConfig(env).provider, 'anthropic');

  // 지정했는데 키가 없으면 에이전트 키를 빌려오지 않고 실패한다.
  assert.throws(
    () => getAliasLLMConfig({ ...env, ALIAS_LLM_API_KEY: '' }),
    (err) => err instanceof LLMConfigError && err.message.includes('ALIAS_LLM_API_KEY'),
  );
});

test('openai-compatible인데 base URL이 없으면 에러', () => {
  assert.throws(
    () =>
      getAgentLLMConfig({
        AGENT_LLM_PROVIDER: 'openai-compatible',
        AGENT_LLM_MODEL: 'm',
        AGENT_LLM_API_KEY: SECRET,
      }),
    (err) => err instanceof LLMConfigError && err.message.includes('AGENT_LLM_BASE_URL'),
  );
});

test('anthropic 외 공급사는 기본 모델이 없어 모델을 요구한다', () => {
  assert.throws(
    () => getAgentLLMConfig({ AGENT_LLM_PROVIDER: 'openai', AGENT_LLM_API_KEY: SECRET }),
    /AGENT_LLM_MODEL/,
  );
});

test('구 키만 설정되면 새 키 이름을 알려주고 실패', () => {
  const cases: [Record<string, string>, string][] = [
    [{ ANTHROPIC_API_KEY: SECRET }, 'AGENT_LLM_API_KEY'],
    [{ AGENT_LLM_API_KEY: SECRET, LLM_MODEL: 'x' }, 'AGENT_LLM_MODEL'],
    [{ AGENT_LLM_API_KEY: SECRET, ALIAS_MODEL: 'x' }, 'ALIAS_LLM_MODEL'],
  ];
  for (const [env, newKey] of cases) {
    for (const get of [getAgentLLMConfig, getAliasLLMConfig]) {
      assert.throws(
        () => get(env),
        (err) => err instanceof LLMConfigError && err.message.includes(newKey),
      );
    }
  }
  // 새 키도 있으면 구 키는 문제 삼지 않는다.
  assert.doesNotThrow(() =>
    getAgentLLMConfig({ ANTHROPIC_API_KEY: 'old', AGENT_LLM_API_KEY: SECRET }),
  );
});

test('빈 문자열은 미설정으로 처리', () => {
  const env = {
    AGENT_LLM_PROVIDER: '',
    AGENT_LLM_MODEL: '  ',
    AGENT_LLM_API_KEY: SECRET,
    AGENT_LLM_BASE_URL: '',
    ALIAS_LLM_PROVIDER: '',
    ALIAS_LLM_API_KEY: '',
    LLM_MODEL: '',
  };
  assert.equal(getAgentLLMConfig(env).model, 'claude-opus-5-5');
  assert.equal(getAgentLLMConfig(env).baseURL, undefined);
  assert.equal(getAliasLLMConfig(env).apiKey, SECRET);
  assert.throws(() => getAgentLLMConfig({ AGENT_LLM_API_KEY: '' }), /AGENT_LLM_API_KEY/);
});

test('에러 메시지에 API 키 값을 넣지 않는다', () => {
  const envs = [
    { AGENT_LLM_PROVIDER: 'nope', AGENT_LLM_API_KEY: SECRET },
    { AGENT_LLM_PROVIDER: 'openai-compatible', AGENT_LLM_API_KEY: SECRET, AGENT_LLM_MODEL: 'm' },
    { ANTHROPIC_API_KEY: SECRET },
  ];
  for (const env of envs) {
    assert.throws(
      () => getAgentLLMConfig(env),
      (err) => !(err as Error).message.includes(SECRET),
    );
  }
});
