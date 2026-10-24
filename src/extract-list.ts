// npm run extract: 약관 원문(TERMS_PATH)에서 LLM으로 회사명·브랜드명을 추출하고 별칭을 보강해 OUTPUT_PATH에 저장한다.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { enrichAliases } from './aliases.ts';
import { extractTerms } from './extract.ts';
import { createLanguageModel } from './llm.ts';
import { getAliasLLMConfig, loadLLMConfigOrExit } from './llm-config.ts';
import { buildMvnoList, latestFetchedAt } from './mvno-list.ts';
import { ALIAS_CACHE_PATH, OUTPUT_PATH, TERMS_PATH } from './paths.ts';
import type { MvnoListFile, TermsByMno } from './types.ts';

const ALIAS_REFRESH = process.env.ALIAS_REFRESH === 'true';

// 약관 추출과 별칭 보강은 같은 LLM 설정(ALIAS_LLM_*)을 쓴다.
const llm = loadLLMConfigOrExit(getAliasLLMConfig);
console.log(`extract llm: ${llm.provider} ${llm.model}`);
const model = createLanguageModel(llm);

const terms = JSON.parse(await readFile(TERMS_PATH, 'utf8')) as TermsByMno;
const { list, errors } = await buildMvnoList(terms, (text) => extractTerms(model, text));
if (errors.length) {
  // 기존 배포본을 덮어쓰지 않도록 출력 파일을 쓰지 않고 실패한다.
  console.error(['MVNO 목록 생성 실패:', ...errors].join('\n  '));
  process.exit(1);
}

await enrichAliases(list, { cachePath: ALIAS_CACHE_PATH, llm, refresh: ALIAS_REFRESH });

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
const file: MvnoListFile = { mnos: list, fetched_at: latestFetchedAt(terms) };
await writeFile(OUTPUT_PATH, JSON.stringify(file, null, 2) + '\n');
console.log(`wrote ${OUTPUT_PATH}: ` + list.map((e) => `${e.mno} ${e.mvnos.length}`).join(', '));
