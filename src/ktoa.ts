// KTOA 표기 별칭: 각 MVNO에 ktoa_alias = 회사명 + KT|SKT|LGT (괄호 없이 붙여 씀)를 넣는다.
import type { MvnoList } from './types.ts';

// 출력 JSON의 mno → KTOA 표기
export const KTOA_MNO: Record<string, string> = {
  SKT: 'SKT',
  KT: 'KT',
  'LG U+': 'LGT',
};

export const ktoaAlias = (mvnoName: string, mno: string): string => {
  const code = KTOA_MNO[mno];
  if (!code) throw new Error(`KTOA 표기가 정해지지 않은 mno: ${mno}`);
  return `${mvnoName}${code}`;
};

// mvno_alias에는 넣지 않는다. 여러 번 실행해도 결과가 같다.
export function addKtoaAliases(list: MvnoList): MvnoList {
  for (const { mno, mvnos } of list) {
    for (const m of mvnos) m.ktoa_alias = ktoaAlias(m.mvno_name, mno);
  }
  return list;
}
