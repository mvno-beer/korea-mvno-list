// README 최상단의 "최근 데이터" 링크 블록. markdown 단계가 실행될 때마다 다시 쓴다.
import { basename, dirname, relative } from 'node:path';

export const README_START = '<!-- mvno-links:start (npm run markdown이 자동 생성) -->';
export const README_END = '<!-- mvno-links:end -->';

export interface ReadmeLinks {
  // README 기준 상대 경로
  jsonPath: string;
  markdownPath: string;
  fetchedAt: string | null;
  // 설정되어 있으면 gist 링크도 붙인다.
  gistId?: string;
}

// gist 페이지의 파일 앵커: 파일명을 소문자로 바꾸고 영숫자 외 문자를 -로 바꾼다. (mvno-list.json → file-mvno-list-json)
const gistFileUrl = (gistId: string, path: string): string =>
  `https://gist.github.com/${gistId}#file-${basename(path).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export function renderReadmeLinks({ jsonPath, markdownPath, fetchedAt, gistId }: ReadmeLinks): string {
  const line = (label: string, path: string) =>
    `- ${label}: [\`${path}\`](${path})` + (gistId ? ` · [gist](${gistFileUrl(gistId, path)})` : '');
  return [
    README_START,
    `**최근 데이터** (수집: ${fetchedAt ?? '알 수 없음'})`,
    '',
    line('JSON', jsonPath),
    line('Markdown 표', markdownPath),
    README_END,
  ].join('\n');
}

// 표시 사이를 교체한다. 표시가 없으면 맨 위에 넣는다.
export function updateReadme(readme: string, block: string): string {
  const start = readme.indexOf(README_START);
  const end = readme.indexOf(README_END);
  if (start >= 0 && end > start) {
    return readme.slice(0, start) + block + readme.slice(end + README_END.length);
  }
  return `${block}\n\n${readme}`;
}

// README에서 본 출력 파일의 상대 경로 (링크용, 구분자는 /)
export const linkPath = (readmePath: string, target: string): string =>
  relative(dirname(readmePath), target).split('\\').join('/');
