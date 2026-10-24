import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { MockLanguageModelV4 } from 'ai/test';
import { enrichAliases, queryAliases } from '../src/aliases.ts';
import type { Mvno, MvnoList } from '../src/types.ts';
import { generateResult } from './mock-model.ts';

test('enrichAliases: 캐시된 별칭을 약관 브랜드명 뒤에 합친다 (LLM 호출 없음)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aliases-'));
  const cachePath = join(dir, 'alias-cache.json');
  await writeFile(
    cachePath,
    JSON.stringify({
      'LG헬로비전(헬로모바일)': ['헬로모바일', 'Hello Mobile', ' 헬모 '],
      스마텔: ['스마텔', 'SMARTEL'],
    }),
  );

  const list: MvnoList = [
    {
      mno: 'KT',
      mvnos: [
        { mvno_name: 'LG헬로비전', mvno_alias: ['헬로모바일'] },
        { mvno_name: '스마텔', mvno_alias: [] },
      ],
    },
  ];
  // 캐시에 모두 있으므로 llm 설정은 쓰이지 않는다.
  await enrichAliases(list, { cachePath, llm: null });

  assert.deepEqual(list[0].mvnos, [
    { mvno_name: 'LG헬로비전', mvno_alias: ['헬로모바일', 'Hello Mobile', '헬모'] },
    { mvno_name: '스마텔', mvno_alias: ['SMARTEL'] },
  ]);
  const saved = JSON.parse(await readFile(cachePath, 'utf8'));
  assert.deepEqual(Object.keys(saved), ['LG헬로비전(헬로모바일)', '스마텔']);
});

const MVNOS: Mvno[] = [{ mvno_name: '스마텔', mvno_alias: [] }];

test('queryAliases: 스키마 불일치 시 1회 재시도', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      generateResult('{"bad":1}'),
      generateResult('{"items":[{"mvno_name":"스마텔","aliases":["SMARTEL"]}]}'),
    ],
  });
  const answers = await queryAliases(model, 'KT', MVNOS);
  assert.deepEqual([...answers], [['스마텔', ['SMARTEL']]]);
  assert.equal(model.doGenerateCalls.length, 2);
});

test('queryAliases: 재시도 후에도 불일치하면 실패', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [generateResult('{"bad":1}'), generateResult('not json')],
  });
  await assert.rejects(queryAliases(model, 'KT', MVNOS), /KT 별칭 응답이 스키마와 맞지 않습니다 \(2회 시도\)/);
  assert.equal(model.doGenerateCalls.length, 2);
});
