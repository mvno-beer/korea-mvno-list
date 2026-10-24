import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TermsExtractionError, type ExtractedTerms } from '../src/extract.ts';
import { buildMvnoList, latestFetchedAt, type Mno } from '../src/mvno-list.ts';
import type { TermsByMno, TermsRecord } from '../src/types.ts';

const record = (mno: string): TermsRecord => ({
  carrier: `알뜰폰 ${mno}`,
  mno,
  text: `[${mno}] 약관`,
  source: 'overlay',
  url: '',
  fetched_at: '2026-10-24T04:11:17.849Z',
});
const all: TermsByMno = { 'LG U+': record('LG U+'), SKT: record('SKT'), KT: record('KT') };

// 원문 맨 앞 [통신사]를 통신사로 읽는 가짜 추출기
const stubExtract = async (text: string): Promise<ExtractedTerms> => {
  const mno = text.match(/^\[(.+?)\]/)![1] as Mno;
  return { mno, mvnos: [{ mvno_name: `${mno}-mvno`, mvno_alias: [] }] };
};

test('buildMvnoList: SKT, KT, LG U+ 순서', async () => {
  const { list, errors } = await buildMvnoList(all, stubExtract);
  assert.deepEqual(errors, []);
  assert.deepEqual(list.map((e) => e.mno), ['SKT', 'KT', 'LG U+']);
  assert.equal(list[2].mvnos[0].mvno_name, 'LG U+-mvno');
  assert.deepEqual(Object.keys(list[0]), ['mno', 'mvnos']);
});

test('buildMvnoList: 빠진 통신사, 추출 실패, 통신사 불일치를 오류로 모은다', async () => {
  const terms: TermsByMno = {
    SKT: { ...record('SKT'), text: '입력 화면' },
    // 에이전트는 KT라고 했지만 원문은 SKT 약관
    KT: { ...record('KT'), text: '[SKT] 약관' },
  };
  const extract = async (text: string): Promise<ExtractedTerms> => {
    if (text === '입력 화면') throw new TermsExtractionError('약관이 아닙니다.');
    return stubExtract(text);
  };
  const { errors } = await buildMvnoList(terms, extract);
  assert.deepEqual(errors, [
    'SKT: 약관이 아닙니다.',
    'KT: 수집한 약관은 SKT의 약관입니다. (carrier: 알뜰폰 KT)',
    'LG U+: 약관이 수집되지 않았습니다.',
  ]);
});

test('buildMvnoList: 원문에서 통신사를 알 수 없으면 에이전트가 고른 통신사를 쓴다', async () => {
  const { list, errors } = await buildMvnoList(all, async () => ({
    mno: null,
    mvnos: [{ mvno_name: 'x', mvno_alias: [] }],
  }));
  assert.deepEqual(errors, []);
  assert.equal(list.length, 3);
});

test('latestFetchedAt: 통신사별 수집 시각 중 가장 늦은 것, 없으면 null', () => {
  const at = (mno: string, fetched_at: string): TermsRecord => ({ ...record(mno), fetched_at });
  assert.equal(
    latestFetchedAt({
      SKT: at('SKT', '2026-10-24T04:11:17.849Z'),
      KT: at('KT', '2026-10-24T04:12:33.865Z'),
      'LG U+': at('LG U+', '2026-10-24T04:12:01.967Z'),
    }),
    '2026-10-24T04:12:33.865Z',
  );
  assert.equal(latestFetchedAt({}), null);
});
