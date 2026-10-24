// 약관의 회사명/브랜드명 외 별칭(약칭, 영문명 등)을 LLM에 질의해 mvno_alias에 추가한다.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { generateObject, type LanguageModel, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { createLanguageModel } from './llm.ts';
import type { LLMConfig } from './llm-config.ts';
import type { Mvno, MvnoList } from './types.ts';

// 스키마에 맞지 않는 응답을 받았을 때의 최대 시도 횟수 (최초 1회 + 재시도 1회)
const MAX_ATTEMPTS = 2;

const AliasResponse = z.object({
  items: z.array(
    z.object({
      mvno_name: z.string(),
      aliases: z.array(z.string()),
    }),
  ),
});

// 캐시 키("회사명(브랜드명)") → LLM 별칭
type AliasCache = Record<string, string[]>;

// 약관 표기 그대로를 키로 쓴다. 브랜드가 바뀌면 다시 질의한다.
const cacheKey = (mvno: Mvno): string =>
  mvno.mvno_alias.length ? `${mvno.mvno_name}(${mvno.mvno_alias.join(', ')})` : mvno.mvno_name;

async function readCache(path: string): Promise<AliasCache> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as AliasCache;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

function buildPrompt(mno: string, mvnos: Mvno[]): string {
  const lines = mvnos.map((m) => `- ${cacheKey(m)}`).join('\n');
  return `다음은 한국 이동통신사 ${mno} 망을 쓰는 알뜰폰(MVNO) 사업자 목록이다. 형식은 "회사명(브랜드명)"이며 브랜드명이 없을 수 있다.

${lines}

각 사업자에 대해, 사람들이 그 사업자나 알뜰폰 서비스를 부를 때 쓰는 다른 이름을 aliases로 제시하라.
- 포함: 알뜰폰 브랜드명, 약칭, 별칭, 영문 표기, 이전 브랜드명
- 법인 표기(㈜, (주), 주식회사, 유한회사 등)는 붙이지 않는다.
- 제외: 목록에 이미 적힌 회사명·브랜드명, 법인 표기만 다른 이름, 확실하지 않은 이름
- 알뜰폰과 무관한 계열사·모회사 이름은 넣지 않는다.
- 아는 것이 없으면 빈 배열로 둔다.
- mvno_name에는 목록의 회사명을 괄호 앞부분 그대로 적는다.`;
}

export async function queryAliases(
  model: LanguageModel,
  mno: string,
  mvnos: Mvno[],
): Promise<Map<string, string[]>> {
  for (let attempt = 1; ; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: AliasResponse,
        prompt: buildPrompt(mno, mvnos),
      });
      return new Map(object.items.map((i) => [i.mvno_name.trim(), i.aliases]));
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`${mno} 별칭 응답이 스키마와 맞지 않습니다 (${attempt}회 시도).`, {
          cause: err,
        });
      }
      console.warn(`aliases: ${mno} 응답이 스키마와 맞지 않아 다시 질의합니다.`);
    }
  }
}

// mvno_alias = [약관 브랜드명, ...LLM 별칭]
// llm은 캐시에 없는 사업자가 있을 때만 쓰인다.
export async function enrichAliases(
  list: MvnoList,
  { cachePath, llm, refresh = false }: { cachePath: string; llm: LLMConfig | null; refresh?: boolean },
): Promise<MvnoList> {
  const cache = refresh ? {} : await readCache(cachePath);
  let model: LanguageModel | undefined;

  for (const { mno, mvnos } of list) {
    const missing = mvnos.filter((m) => !(cacheKey(m) in cache));
    if (missing.length) {
      if (!llm) throw new Error('별칭 캐시에 없는 사업자가 있지만 LLM 설정이 없습니다.');
      model ??= createLanguageModel(llm);
      const answers = await queryAliases(model, mno, missing);
      for (const m of missing) cache[cacheKey(m)] = answers.get(m.mvno_name) ?? [];
      console.log(`aliases: ${mno} ${missing.length}건 질의`);
    }
  }

  for (const { mvnos } of list) {
    for (const m of mvnos) {
      // 법인 표기 제거는 LLM이 한다(프롬프트). 코드는 공백만 정리한다.
      const extra = cache[cacheKey(m)].map((a) => a.trim());
      m.mvno_alias = [...new Set([...m.mvno_alias, ...extra])].filter(
        (a) => a && a !== m.mvno_name,
      );
    }
  }

  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(sorted, null, 2) + '\n');
  return list;
}
