// 약관 원문 → MVNO 목록. LLM으로 추출하고, 결과의 모든 이름이 원문에 있는지 코드로 확인한다.
import { generateObject, type LanguageModel, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { MNOS, type Mno } from './mvno-list.ts';
import type { Mvno } from './types.ts';

// 스키마 불일치나 원문 대조 실패 시 최대 시도 횟수 (최초 1회 + 재시도 1회)
const MAX_ATTEMPTS = 2;

const ExtractResponse = z.object({
  is_mvno_terms: z.boolean(),
  mno: z.enum(MNOS).nullable(),
  mvnos: z.array(
    z.object({
      mvno_name: z.string(),
      brand_name: z.string().nullable(),
    }),
  ),
});
type ExtractResponse = z.infer<typeof ExtractResponse>;

export interface ExtractedTerms {
  // 약관에 적힌 망 제공 통신사. 알 수 없으면 null
  mno: Mno | null;
  mvnos: Mvno[];
}

export class TermsExtractionError extends Error {
  name = 'TermsExtractionError';
}

// 법인 표기 제거는 LLM이 한다. 코드는 공백만 정리한다.
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

// 원문 대조용: 공백·대소문자 차이는 무시한다. 법인 표기를 뺀 이름도 원문 표기의 일부이므로 그대로 대조된다.
const normalize = (s: string): string => s.replace(/\s+/g, '').toLowerCase();

// 원문에 없는 이름 목록. 비어 있어야 통과다.
export function ungroundedNames(text: string, mvnos: ExtractResponse['mvnos']): string[] {
  const source = normalize(text);
  return mvnos
    .flatMap((m) => [m.mvno_name, m.brand_name])
    .filter((name): name is string => !!name && !source.includes(normalize(name)));
}

function buildPrompt(text: string): string {
  return `다음은 한국 휴대폰 본인확인 페이지에서 가져온 약관 텍스트다.

<terms>
${text}
</terms>

- is_mvno_terms: 이 텍스트가 특정 이동통신사 망을 쓰는 알뜰폰(MVNO) 사업자 목록을 담은 약관이면 true, 아니면 false
- mno: 그 알뜰폰 사업자들이 쓰는 망의 이동통신사. SK텔레콤이면 "SKT", KT(케이티)면 "KT", LG유플러스(엘지유플러스)면 "LG U+". 텍스트로 알 수 없으면 null
- mvnos: 텍스트에 나열된 알뜰폰 사업자 전부를 나온 순서대로 빠짐없이 적는다.
  - mvno_name: 회사명. 텍스트에 적힌 표기에서 법인 표기(㈜, (주), 주식회사, 유한회사 등 회사 형태를 나타내는 말)만 빼고, 나머지 글자는 바꾸지 않는다. 예: "㈜LG헬로비전" → "LG헬로비전", "드림라인㈜" → "드림라인"
  - brand_name: 텍스트에서 그 회사명과 함께 적힌 브랜드명(예: 괄호 안의 이름). mvno_name과 같은 규칙으로 법인 표기를 뺀다. 텍스트에 없으면 null. 추측하지 않는다.
- 텍스트에 없는 이름은 절대 만들지 않는다.
- is_mvno_terms가 false면 mvnos는 빈 배열로 둔다.`;
}

function toMvnos(items: ExtractResponse['mvnos']): Mvno[] {
  const seen = new Map<string, Mvno>();
  for (const item of items) {
    const name = clean(item.mvno_name);
    if (!name) continue;
    const brand = item.brand_name ? clean(item.brand_name) : '';
    const aliases = brand && brand !== name ? [brand] : [];
    const prev = seen.get(name);
    if (prev) prev.mvno_alias = [...new Set([...prev.mvno_alias, ...aliases])];
    else seen.set(name, { mvno_name: name, mvno_alias: aliases });
  }
  return [...seen.values()];
}

export async function extractTerms(model: LanguageModel, text: string): Promise<ExtractedTerms> {
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let object: ExtractResponse;
    try {
      ({ object } = await generateObject({ model, schema: ExtractResponse, prompt: buildPrompt(text) }));
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      lastError = '응답이 스키마와 맞지 않습니다.';
      console.warn(`extract: ${lastError} 다시 질의합니다.`);
      continue;
    }

    // 약관이 아니라는 판단은 재시도하지 않는다. 다른 팝업을 연 경우라 에이전트가 고쳐야 한다.
    if (!object.is_mvno_terms) {
      throw new TermsExtractionError('알뜰폰 사업자 목록이 있는 약관이 아닙니다.');
    }
    const ungrounded = ungroundedNames(text, object.mvnos);
    if (ungrounded.length) {
      lastError = `원문에 없는 이름이 있습니다: ${ungrounded.join(', ')}`;
      console.warn(`extract: ${lastError} 다시 질의합니다.`);
      continue;
    }
    const mvnos = toMvnos(object.mvnos);
    if (!mvnos.length) throw new TermsExtractionError('약관에서 알뜰폰 사업자를 찾지 못했습니다.');
    return { mno: object.mno, mvnos };
  }
  throw new TermsExtractionError(`약관 추출 실패 (${MAX_ATTEMPTS}회 시도): ${lastError}`);
}
