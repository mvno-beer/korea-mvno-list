import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addKtoaAliases, ktoaAlias } from '../src/ktoa.ts';
import type { MvnoList } from '../src/types.ts';

test('ktoaAlias: 회사명에 통신사 표기를 괄호 없이 붙이고, LG U+는 LGT', () => {
  assert.equal(ktoaAlias('KCT', 'SKT'), 'KCTSKT');
  assert.equal(ktoaAlias('LG헬로비전', 'KT'), 'LG헬로비전KT');
  assert.equal(ktoaAlias('미디어로그', 'LG U+'), '미디어로그LGT');
  assert.throws(() => ktoaAlias('x', 'unknown'), /unknown/);
});

test('addKtoaAliases: ktoa_alias에 넣고 mvno_alias에는 넣지 않음', () => {
  const list: MvnoList = [
    { mno: 'SKT', mvnos: [{ mvno_name: 'KCT', mvno_alias: ['티플러스'] }] },
    { mno: 'LG U+', mvnos: [{ mvno_name: '울산방송', mvno_alias: [], ktoa_alias: '울산방송(LGT)' }] },
  ];
  addKtoaAliases(list);
  addKtoaAliases(list);
  assert.deepEqual(list[0].mvnos[0], {
    mvno_name: 'KCT',
    mvno_alias: ['티플러스'],
    ktoa_alias: 'KCTSKT',
  });
  // 예전 형식 값은 새 형식으로 덮어쓴다.
  assert.deepEqual(list[1].mvnos[0], {
    mvno_name: '울산방송',
    mvno_alias: [],
    ktoa_alias: '울산방송LGT',
  });
});
