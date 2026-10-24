import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toMarkdownTable } from '../src/markdown.ts';

test('toMarkdownTable: MNO·MVNO마다 한 행, 별칭은 쉼표로 연결, ktoa_alias는 별도 칸', () => {
  const md = toMarkdownTable([
    {
      mno: 'SKT',
      mvnos: [
        { mvno_name: 'KCT', mvno_alias: ['티플러스', 'tplus'], ktoa_alias: 'KCTSKT' },
        { mvno_name: '장성모바일', mvno_alias: [] },
      ],
    },
    { mno: 'LG U+', mvnos: [{ mvno_name: 'A|B', mvno_alias: ['x|y'] }] },
  ]);
  assert.equal(
    md,
    [
      '| mno | mvno | mvno_alias | ktoa_alias |',
      '| --- | --- | --- | --- |',
      '| SKT | KCT | 티플러스,tplus | KCTSKT |',
      '| SKT | 장성모바일 |  |  |',
      '| LG U+ | A\\|B | x\\|y |  |',
      '',
    ].join('\n'),
  );
});
