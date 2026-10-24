import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carrierToMno, pickCandidate } from '../src/save-terms.ts';

test('carrierToMno: 에이전트가 넘긴 통신사명 해석', () => {
  assert.equal(carrierToMno('알뜰폰 SKT'), 'SKT');
  assert.equal(carrierToMno('SK텔레콤 알뜰폰'), 'SKT');
  assert.equal(carrierToMno('알뜰폰 KT'), 'KT');
  assert.equal(carrierToMno('케이티'), 'KT');
  assert.equal(carrierToMno('알뜰폰 LG U+'), 'LG U+');
  assert.equal(carrierToMno('LGU+'), 'LG U+');
  assert.equal(carrierToMno('엘지유플러스'), 'LG U+');
  assert.equal(carrierToMno('모름'), null);
});

test('pickCandidate: 주제어 많은 것 → overlay 우선 → 짧은 것', () => {
  const page = { source: 'page' as const, url: 'u', text: '본인확인 ... 알뜰폰 개인정보 제3자 제공동의 ... 약관 전문' };
  const overlay = { source: 'overlay' as const, url: 'u', text: '알뜰폰 사업자는 제3자에게 제공 ...' };
  const buttons = { source: 'overlay' as const, url: 'u', text: '확인 취소' };
  const otherOverlay = { source: 'overlay' as const, url: 'u', text: '알뜰폰 이벤트 안내' };
  assert.equal(pickCandidate([page, buttons, otherOverlay, overlay]), overlay);
  // 약관 팝업이 overlay로 잡히지 않으면 페이지 전체로 대신한다.
  assert.equal(pickCandidate([page, buttons, otherOverlay]), page);
  assert.equal(pickCandidate([buttons]), null);
});
