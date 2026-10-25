// npm run markdown: MVNO 목록 JSON에 ktoa_alias를 넣고, 같은 내용을 markdown 표로도 만든다.
// README 최상단의 최근 데이터 링크도 갱신한다.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { addKtoaAliases } from './ktoa.ts';
import { MARKDOWN_PATH, OUTPUT_PATH, README_PATH } from './paths.ts';
import { linkPath, renderReadmeLinks, updateReadme } from './readme.ts';
import type { MvnoList, MvnoListFile } from './types.ts';

// 표 칸을 깨뜨리는 |와 줄바꿈만 처리한다.
const cell = (s: string): string => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export function toMarkdownTable(list: MvnoList): string {
  const rows = list.flatMap(({ mno, mvnos }) =>
    mvnos.map(
      (m) =>
        `| ${cell(mno)} | ${cell(m.mvno_name)} | ${m.mvno_alias.map(cell).join(',')} | ${cell(m.ktoa_alias ?? '')} |`,
    ),
  );
  const header = ['| mno | mvno | mvno_alias | ktoa_alias |', '| --- | --- | --- | --- |'];
  return [...header, ...rows].join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = JSON.parse(await readFile(OUTPUT_PATH, 'utf8')) as MvnoListFile;
  addKtoaAliases(file.mnos);
  await writeFile(OUTPUT_PATH, JSON.stringify(file, null, 2) + '\n');
  await writeFile(MARKDOWN_PATH, toMarkdownTable(file.mnos));

  const block = renderReadmeLinks({
    jsonPath: linkPath(README_PATH, OUTPUT_PATH),
    markdownPath: linkPath(README_PATH, MARKDOWN_PATH),
    fetchedAt: file.fetched_at,
  });
  await writeFile(README_PATH, updateReadme(await readFile(README_PATH, 'utf8'), block));
  console.log(`wrote ${OUTPUT_PATH}, ${MARKDOWN_PATH}, ${README_PATH}`);
}
