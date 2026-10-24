// save_terms 커스텀 액션: 화면에 열린 약관 원문을 LLM을 거치지 않고 직접 읽어 저장한다.
// 특정 사이트의 요소(id, class)에 의존하지 않는다. 사업자 추출과 통신사 대조는 extract 단계가 한다.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ActionResult, type Controller, type RegistryActionHandler } from 'browser-use';
import { z } from 'zod';
import type { Mno } from './mvno-list.ts';
import type { TermsByMno } from './types.ts';

type Page = NonNullable<Parameters<RegistryActionHandler>[1]['page']>;

const SaveTermsParams = z.object({
  carrier: z.string().describe('현재 선택한 통신사명 (예: 알뜰폰 SKT)'),
});

// 원문 후보의 종류. 앞일수록 약관만 담고 있을 가능성이 높다.
const SOURCE_PRIORITY = ['overlay', 'frame', 'page'] as const;
type Source = (typeof SOURCE_PRIORITY)[number];

interface Candidate {
  source: Source;
  text: string;
  url: string;
}

// 짧은 버튼 묶음 같은 것은 약관이 아니다.
const MIN_TEXT_LENGTH = 100;

// 에이전트가 넘긴 통신사명 → mno. 알 수 없으면 null
export function carrierToMno(carrier: string): Mno | null {
  const c = carrier.replace(/\s+/g, '').toUpperCase();
  if (/LG|U\+|유플러스|엘지/.test(c)) return 'LG U+';
  // SKT에 KT가 들어 있으므로 SK를 먼저 본다.
  if (/SK|에스케이/.test(c)) return 'SKT';
  if (/KT|케이티/.test(c)) return 'KT';
  return null;
}

// 열린 모든 탭과 frame에서 원문 후보를 모은다.
// overlay: 화면 위에 뜬 요소(dialog, role=dialog, aria-modal, position:fixed)
// frame/page: frame 또는 탭 전체 텍스트 (팝업이 iframe·새 탭이거나 overlay로 잡히지 않는 경우)
async function collectCandidates(currentPage: Page): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const page of currentPage.context().pages()) {
    for (const frame of page.frames()) {
      let found: { overlays: string[]; body: string };
      try {
        found = await frame.evaluate((minLength) => {
          const overlays: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('body *')) {
            const style = getComputedStyle(el);
            const isOverlay =
              el.tagName === 'DIALOG' ||
              el.getAttribute('role') === 'dialog' ||
              el.getAttribute('aria-modal') === 'true' ||
              style.position === 'fixed';
            if (!isOverlay || style.display === 'none' || style.visibility === 'hidden') continue;
            const rect = el.getBoundingClientRect();
            const text = el.innerText?.trim() ?? '';
            if (rect.width > 0 && rect.height > 0 && text.length >= minLength) overlays.push(text);
          }
          return { overlays, body: document.body?.innerText?.trim() ?? '' };
        }, MIN_TEXT_LENGTH);
      } catch {
        continue; // 닫히는 중이거나 접근할 수 없는 frame
      }
      const url = frame.url();
      for (const text of found.overlays) candidates.push({ source: 'overlay', text, url });
      if (found.body.length >= MIN_TEXT_LENGTH) {
        const isMain = page === currentPage && frame === page.mainFrame();
        candidates.push({ source: isMain ? 'page' : 'frame', text: found.body, url });
      }
    }
  }
  return candidates;
}

// 찾는 약관의 주제어를 많이 담은 후보 → overlay 우선 → 짧은 것(군더더기가 적은 것) 순
const KEYWORDS = ['알뜰폰', '제3자', '제공'];
const score = (text: string): number => KEYWORDS.filter((k) => text.includes(k)).length;

export function pickCandidate(candidates: Candidate[]): Candidate | null {
  const relevant = candidates.filter((c) => c.text.includes('알뜰폰'));
  relevant.sort(
    (a, b) =>
      score(b.text) - score(a.text) ||
      SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source) ||
      a.text.length - b.text.length,
  );
  return relevant[0] ?? null;
}

export function registerSaveTerms(
  controller: Controller,
  { outputPath }: { outputPath: string },
): TermsByMno {
  const terms: TermsByMno = {};

  controller.registry.action(
    '현재 화면에 열린 "알뜰폰 개인정보 제3자 제공동의" 약관의 원문을 저장한다. 약관 본문은 이 액션이 화면에서 직접 읽으므로 넘기지 않는다.',
    { param_model: SaveTermsParams },
  )<z.infer<typeof SaveTermsParams>>(async function save_terms(params, { page, browser_session }) {
    page ??= await browser_session?.get_current_page();
    if (!page) return new ActionResult({ error: '열린 페이지가 없습니다.' });

    const mno = carrierToMno(params.carrier);
    if (!mno) {
      return new ActionResult({
        error: `통신사를 알 수 없다 (carrier: ${params.carrier}). carrier에 알뜰폰 SKT/KT/LG U+ 중 하나를 넣어라.`,
      });
    }
    const candidate = pickCandidate(await collectCandidates(page));
    if (!candidate) {
      return new ActionResult({
        error: '화면에서 알뜰폰 약관을 찾지 못했습니다. 약관을 연 뒤 다시 시도하라.',
      });
    }

    terms[mno] = {
      carrier: params.carrier,
      mno,
      text: candidate.text,
      source: candidate.source,
      url: candidate.url,
      fetched_at: new Date().toISOString(),
    };
    // 중간에 실패해도 수집분이 남도록 매번 기록한다.
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(terms, null, 2) + '\n');

    return new ActionResult({
      extracted_content: `saved ${mno} (${candidate.source}, ${candidate.text.length} chars)`,
      long_term_memory: `${mno} 약관 저장 완료`,
    });
  });

  return terms;
}
