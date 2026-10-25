<!-- mvno-links:start (npm run markdown이 자동 생성) -->
**최근 데이터** (수집: 2026-10-24T09:28:23.969Z)

- JSON: [`data/mvno-list.json`](data/mvno-list.json)
- Markdown 표: [`data/mvno-list.md`](data/mvno-list.md)
<!-- mvno-links:end -->

# korea-mvno-list

한국 이동통신사(MNO)별 알뜰폰(MVNO) 사업자 목록을 JSON과 markdown 표로 제공한다.

본인확인 서비스의 "알뜰폰 개인정보 제3자 제공동의" 약관에는 통신사마다 그 망을 쓰는 알뜰폰 사업자가 나열되어 있다. 이 저장소는 브라우저 에이전트([browser-use](https://www.npmjs.com/package/browser-use))로 그 약관을 수집하고, LLM으로 사업자 이름을 뽑아 매달 갱신한다.

## 데이터

| 파일 | 내용 |
| --- | --- |
| [`data/mvno-list.json`](data/mvno-list.json) | 통신사별 MVNO 목록 |
| [`data/mvno-list.md`](data/mvno-list.md) | 같은 내용의 markdown 표 |

```json
{
  "mnos": [
    {
      "mno": "SKT",
      "mvnos": [
        {
          "mvno_name": "KCT",
          "mvno_alias": ["한국케이블텔레콤", "티플러스", "tplus"],
          "ktoa_alias": "KCTSKT"
        }
      ]
    }
  ],
  "fetched_at": "2026-10-24T04:12:33.865Z"
}
```

| 키 | 설명 |
| --- | --- |
| `fetched_at` | 약관을 수집한 시각 (ISO 8601, UTC). 알 수 없으면 `null` |
| `mnos[].mno` | 망을 빌려주는 통신사. `SKT`, `KT`, `LG U+` |
| `mvnos[].mvno_name` | 약관에 적힌 회사명 (법인 표기 제외) |
| `mvnos[].mvno_alias` | 다른 이름 목록. 약관에 브랜드명이 있으면 `[0]`이 그 브랜드명이고, 나머지는 LLM이 제시한 약칭·영문 표기 등 |
| `mvnos[].ktoa_alias` | KTOA 표기. 회사명 + `SKT` / `KT` / `LGT` (예: `미디어로그LGT`) |

## 동작 방식

세 단계로 나뉘며, 단계 사이는 파일로 주고받는다.

| 단계 | 스크립트 | 입력 → 출력 |
| --- | --- | --- |
| 1. 약관 수집 | `npm run agent` | 본인확인 페이지 → `output/terms.json` |
| 2. 사업자 추출 | `npm run extract` | `output/terms.json` → `data/mvno-list.json` |
| 3. 표 생성 | `npm run markdown` | `data/mvno-list.json` → `ktoa_alias` 추가, `data/mvno-list.md` |

1. **약관 수집**: browser-use 에이전트가 [`docs/browser-use-prompt.md`](docs/browser-use-prompt.md)의 지시대로 페이지를 조작해 통신사별 약관을 연다. 커스텀 액션 `save_terms`가 화면에 열린 약관 원문을 그대로 저장한다. 약관 본문이 에이전트의 LLM을 거치지 않으므로 바뀌거나 요약되지 않는다.
2. **사업자 추출**: 약관 원문을 LLM에 주고 회사명과 브랜드명을 받는다. 받은 이름이 원문에 실제로 있는지 코드로 대조해, 지어낸 이름을 막는다. 통신사가 하나라도 실패하면 출력 파일을 쓰지 않는다. 이어서 LLM으로 별칭을 보강한다. 별칭은 `data/alias-cache.json`에 저장해 새 사업자만 질의한다.
3. **표 생성**: LLM 없이 `ktoa_alias`를 계산하고 markdown 표를 만든다.

자세한 설계는 [`docs/design.md`](docs/design.md)에 있다.

## 실행

### 로컬

Node.js 22.18 이상이 필요하다. `.ts` 파일을 빌드 없이 Node로 바로 실행한다.

```sh
npm install
npx playwright install chromium
cp .env.example .env    # 최소 AGENT_LLM_API_KEY를 채운다
npm start               # agent → extract → markdown
```

단계별로도 실행할 수 있다. 예를 들어 이미 수집한 약관으로 추출만 다시 하려면 `npm run extract`를 실행한다.

`npm run ...`은 프로젝트 루트의 `.env`를 읽는다. 셸에 이미 설정된 환경변수가 우선한다. `agent`와 `extract`는 LLM API를 호출하므로 비용이 든다.

### Docker

```sh
cp .env.example .env
docker compose build
docker compose run --rm app                        # headless
docker compose run --rm --service-ports headful    # 브라우저 화면: http://localhost:6080/vnc.html?autoconnect=1&resize=scale
```

### 개발

```sh
npm run typecheck
npm test     # 네트워크·LLM 호출 없음
```

## 설정

LLM은 에이전트용과 추출·별칭용을 따로 정한다. 공급사는 각각 Anthropic, OpenAI, OpenAI 호환 API(SiliconFlow 등) 중에서 고른다.

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `AGENT_LLM_PROVIDER` | `anthropic` | `anthropic` \| `openai` \| `openai-compatible` |
| `AGENT_LLM_MODEL` | `claude-opus-5-5` (anthropic일 때) | 다른 공급사는 필수 |
| `AGENT_LLM_API_KEY` | (필수) | |
| `AGENT_LLM_BASE_URL` | | `openai-compatible`이면 필수 |
| `ALIAS_LLM_*` | `AGENT_LLM_*` 상속 | 추출·별칭용. `ALIAS_LLM_PROVIDER`를 지정하면 상속하지 않는다 |

나머지 설정(시작 URL, 별칭 캐시 갱신, headless 등)은 [`.env.example`](.env.example)에 설명과 함께 있다.

## 정기 실행

GitHub Actions([`.github/workflows/monthly.yml`](.github/workflows/monthly.yml))가 매달 2일 00:00 UTC(KST 09:00)에 전체 단계를 실행한다. `data/`가 바뀌었을 때만 커밋한다. 수동 실행(`workflow_dispatch`)도 된다.

저장소에 등록할 값:

| 종류 | 키 |
| --- | --- |
| Secrets | `AGENT_LLM_API_KEY`, 필요하면 `ALIAS_LLM_API_KEY` |
| Variables | 필요하면 `START_URL`, `AGENT_LLM_*`, `ALIAS_LLM_*` |
