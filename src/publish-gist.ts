// 생성한 MVNO 목록 JSON과 markdown 표로 gist를 갱신한다.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { MARKDOWN_PATH, OUTPUT_PATH } from './paths.ts';

const { GIST_ID, GIST_TOKEN } = process.env;

if (!GIST_ID || !GIST_TOKEN) {
  console.error('GIST_ID와 GIST_TOKEN 환경변수가 필요합니다.');
  process.exit(1);
}

const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
  method: 'PATCH',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${GIST_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: JSON.stringify({
    files: Object.fromEntries(
      await Promise.all(
        [OUTPUT_PATH, MARKDOWN_PATH].map(async (p) => [
          basename(p),
          { content: await readFile(p, 'utf8') },
        ]),
      ),
    ),
  }),
});

if (!res.ok) {
  console.error(`gist 갱신 실패: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`updated gist ${GIST_ID}`);
