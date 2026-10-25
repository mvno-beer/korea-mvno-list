import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkPath, README_END, README_START, renderReadmeLinks, updateReadme } from '../src/readme.ts';

const links = { jsonPath: 'data/mvno-list.json', markdownPath: 'data/mvno-list.md' };

test('renderReadmeLinks: 수집 시각과 파일 링크', () => {
  assert.equal(
    renderReadmeLinks({ ...links, fetchedAt: '2026-10-24T04:12:33.865Z' }),
    [
      README_START,
      '**최근 데이터** (수집: 2026-10-24T04:12:33.865Z)',
      '',
      '- JSON: [`data/mvno-list.json`](data/mvno-list.json)',
      '- Markdown 표: [`data/mvno-list.md`](data/mvno-list.md)',
      README_END,
    ].join('\n'),
  );
  assert.match(renderReadmeLinks({ ...links, fetchedAt: null }), /수집: 알 수 없음/);
});

test('updateReadme: 표시가 없으면 맨 위에 넣고, 있으면 그 사이만 교체', () => {
  const readme = '# title\n\nbody\n';
  const first = updateReadme(readme, renderReadmeLinks({ ...links, fetchedAt: 'T1' }));
  assert.ok(first.startsWith(README_START));
  assert.ok(first.endsWith('# title\n\nbody\n'));

  const second = updateReadme(first, renderReadmeLinks({ ...links, fetchedAt: 'T2' }));
  assert.equal(second.split(README_START).length, 2, '블록은 하나만');
  assert.match(second, /수집: T2/);
  assert.doesNotMatch(second, /T1/);
  assert.ok(second.endsWith('# title\n\nbody\n'));
});

test('linkPath: README 기준 상대 경로', () => {
  assert.equal(linkPath('README.md', 'data/mvno-list.json'), 'data/mvno-list.json');
  assert.equal(linkPath('docs/README.md', 'data/mvno-list.json'), '../data/mvno-list.json');
});
