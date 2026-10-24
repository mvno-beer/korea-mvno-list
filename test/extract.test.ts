import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MockLanguageModelV4 } from 'ai/test';
import { extractTerms, TermsExtractionError, ungroundedNames } from '../src/extract.ts';
import { generateResult } from './mock-model.ts';

// 실제 사이트에서 받은 약관 원문
const fixture = (code: string): string =>
  readFileSync(new URL(`./fixtures/terms_${code}.txt`, import.meta.url), 'utf8');

const respond = (body: object) => generateResult(JSON.stringify(body));
const mockModel = (...bodies: (object | string)[]) =>
  new MockLanguageModelV4({
    doGenerate: bodies.map((b) => (typeof b === 'string' ? generateResult(b) : respond(b))),
  });

test('ungroundedNames: 원문에 있는 이름은 법인 표기·공백·대소문자 차이를 무시하고 통과', () => {
  const text = fixture('KTR');
  assert.deepEqual(
    ungroundedNames(text, [
      { mvno_name: 'LG헬로비전', brand_name: '헬로모바일' },
      { mvno_name: '㈜LG헬로비전', brand_name: null },
      { mvno_name: 'KT엠모바일', brand_name: 'kt m모바일' },
    ]),
    [],
  );
});

test('ungroundedNames: 원문에 없는 이름을 잡아낸다', () => {
  // 토스모바일은 다른 화면의 목록에는 있지만 SKT 약관 원문에는 없다.
  assert.deepEqual(
    ungroundedNames(fixture('SKR'), [
      { mvno_name: 'KCT', brand_name: null },
      { mvno_name: '토스모바일', brand_name: null },
      { mvno_name: '스테이지파이브', brand_name: '핀다이렉트' },
    ]),
    ['토스모바일', '핀다이렉트'],
  );
});

test('extractTerms: 브랜드명은 mvno_alias[0], 같은 회사는 합침, 공백 정리', async () => {
  // 법인 표기는 LLM이 빼서 돌려준다.
  const model = mockModel({
    is_mvno_terms: true,
    mno: 'KT',
    mvnos: [
      { mvno_name: ' LG헬로비전 ', brand_name: '헬로모바일' },
      { mvno_name: 'KT텔레캅', brand_name: null },
      { mvno_name: '드림라인', brand_name: '드림모바일' },
      { mvno_name: 'LG헬로비전', brand_name: null },
    ],
  });
  assert.deepEqual(await extractTerms(model, fixture('KTR')), {
    mno: 'KT',
    mvnos: [
      { mvno_name: 'LG헬로비전', mvno_alias: ['헬로모바일'] },
      { mvno_name: 'KT텔레캅', mvno_alias: [] },
      { mvno_name: '드림라인', mvno_alias: ['드림모바일'] },
    ],
  });
});

test('extractTerms: 법인 표기는 코드가 지우지 않는다 (LLM 담당)', async () => {
  const model = mockModel({
    is_mvno_terms: true,
    mno: 'KT',
    mvnos: [{ mvno_name: '드림라인㈜', brand_name: null }],
  });
  const { mvnos } = await extractTerms(model, fixture('KTR'));
  assert.deepEqual(mvnos, [{ mvno_name: '드림라인㈜', mvno_alias: [] }]);
});

test('extractTerms: 원문에 없는 이름이 나오면 1회 재시도', async () => {
  const model = mockModel(
    { is_mvno_terms: true, mno: 'SKT', mvnos: [{ mvno_name: '토스모바일', brand_name: null }] },
    { is_mvno_terms: true, mno: 'SKT', mvnos: [{ mvno_name: 'KCT', brand_name: null }] },
  );
  const result = await extractTerms(model, fixture('SKR'));
  assert.deepEqual(result.mvnos, [{ mvno_name: 'KCT', mvno_alias: [] }]);
  assert.equal(model.doGenerateCalls.length, 2);
});

test('extractTerms: 재시도해도 원문에 없는 이름이 나오면 실패', async () => {
  const bad = { is_mvno_terms: true, mno: 'SKT', mvnos: [{ mvno_name: '토스모바일', brand_name: null }] };
  const model = mockModel(bad, bad);
  await assert.rejects(
    extractTerms(model, fixture('SKR')),
    (err) => err instanceof TermsExtractionError && err.message.includes('토스모바일'),
  );
  assert.equal(model.doGenerateCalls.length, 2);
});

test('extractTerms: 스키마 불일치는 1회 재시도', async () => {
  const model = mockModel('{"bad":1}', {
    is_mvno_terms: true,
    mno: null,
    mvnos: [{ mvno_name: 'KCT', brand_name: null }],
  });
  assert.equal((await extractTerms(model, fixture('SKR'))).mno, null);
  assert.equal(model.doGenerateCalls.length, 2);
});

test('extractTerms: 약관이 아니면 재시도 없이 실패', async () => {
  const model = mockModel({ is_mvno_terms: false, mno: null, mvnos: [] });
  await assert.rejects(
    extractTerms(model, '본인확인 입력 화면'),
    (err) => err instanceof TermsExtractionError && /약관이 아닙니다/.test(err.message),
  );
  assert.equal(model.doGenerateCalls.length, 1);
});
