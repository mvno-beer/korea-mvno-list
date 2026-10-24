// 약관 원문(TERMS_PATH) → 통신사별 MVNO 목록
import type { ExtractedTerms } from './extract.ts';
import type { MvnoList, TermsByMno } from './types.ts';

// 출력 JSON의 mno 값. 이 순서로 출력한다.
export const MNOS = ['SKT', 'KT', 'LG U+'] as const;
export type Mno = (typeof MNOS)[number];

export type ExtractFn = (text: string) => Promise<ExtractedTerms>;

// 통신사마다 약관 원문을 추출한다. 하나라도 실패하면 errors가 비지 않으며, 그때는 배포하지 않는다.
// (빈 목록은 extractTerms가 실패로 처리한다)
export async function buildMvnoList(
  terms: TermsByMno,
  extract: ExtractFn,
): Promise<{ list: MvnoList; errors: string[] }> {
  const list: MvnoList = [];
  const errors: string[] = [];
  for (const mno of MNOS) {
    const record = terms[mno];
    if (!record) {
      errors.push(`${mno}: 약관이 수집되지 않았습니다.`);
      continue;
    }
    let extracted: ExtractedTerms;
    try {
      extracted = await extract(record.text);
    } catch (err) {
      errors.push(`${mno}: ${(err as Error).message}`);
      continue;
    }
    // 에이전트가 고른 통신사와 약관 원문에 적힌 통신사가 다르면 실패다.
    if (extracted.mno && extracted.mno !== mno) {
      errors.push(`${mno}: 수집한 약관은 ${extracted.mno}의 약관입니다. (carrier: ${record.carrier})`);
      continue;
    }
    list.push({ mno, mvnos: extracted.mvnos });
  }
  return { list, errors };
}

// 파일 전체의 fetched_at: 통신사별 수집 시각 중 가장 늦은 것 (마지막 약관을 수집한 시각)
export function latestFetchedAt(terms: TermsByMno): string | null {
  const times = Object.values(terms).flatMap((r) => (r ? [r.fetched_at] : []));
  return times.length ? times.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
}
