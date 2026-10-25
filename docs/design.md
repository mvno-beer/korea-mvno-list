# korea-mvno-list

browser-use를 사용한 한국 mvno list fetcher

## 목표

통신사(MNO)별 알뜰폰(MVNO) 목록을 JSON 파일과 markdown 표로 생성해 GitHub repo로 배포하는 것이 핵심이다.

## 출력 형식

```json
{
  "mnos": [
    {
      "mno": "SKT",
      "mvnos": [
        {
          "mvno_name": "",
          "mvno_alias": [""],
          "ktoa_alias": ""
        }
      ]
    }
  ],
  "fetched_at": "2026-10-24T04:11:17.849Z"
}
```

- `fetched_at`: 약관을 수집한 시각 (ISO 8601, UTC). 파일 전체에 하나다. agent 단계에서 `save_terms`가 통신사마다 `terms.json`에 기록한 수집 시각 중 가장 늦은 것(마지막 약관을 수집한 시각)을 extract 단계가 넣는다. 알 수 없으면 `null`
- `mnos`: 통신사별 목록. `SKT`, `KT`, `LG U+` 순서
- `mno`: 망을 빌려주는 통신사 (`SKT`, `KT`, `LG U+`)
- `mvnos`: 해당 통신사 망을 쓰는 알뜰폰 사업자 목록
  - `mvno_name`: 약관의 회사명
  - `mvno_alias`: 같은 사업자를 가리키는 다른 이름 목록. 약관에 브랜드명이 있으면 `mvno_alias[0]`이고, 그 뒤에 LLM으로 질의한 약칭·별칭이 온다. 없으면 빈 배열
  - `ktoa_alias`: KTOA 표기. 회사명 뒤에 `KT`, `SKT`, `LGT`를 괄호 없이 붙인 문자열 하나. `mvno_alias`에는 넣지 않는다. (예: `KCTSKT`, `미디어로그LGT`)

같은 내용을 markdown 표(`data/mvno-list.md`)로도 만든다. MNO·MVNO 한 쌍이 한 행이고, 별칭은 쉼표로 잇는다. 칸 안의 `|`는 `\|`로 바꾼다.

```markdown
| mno | mvno | mvno_alias | ktoa_alias |
| --- | --- | --- | --- |
| SKT | KCT | 한국케이블텔레콤,티플러스,tplus | KCTSKT |
```

JSON만 있을 때는 `npm run markdown`으로 크롤링 없이 표를 다시 만든다.

`npm run markdown`은 `README.md` 맨 위의 "최근 데이터" 블록도 다시 쓴다. (`src/readme.ts`)

- 내용: 수집 시각(`fetched_at`), JSON과 markdown 표 파일 링크
- `<!-- mvno-links:start ... -->`와 `<!-- mvno-links:end -->` 사이만 교체한다. 표시가 없으면 맨 위에 넣는다. README의 나머지 내용은 건드리지 않는다.
- 경로는 `README_PATH`(기본 `README.md`) 기준 상대 경로다.

## 처리 흐름

세 단계로 나뉘며, 단계마다 npm 스크립트가 있다. 단계 사이는 파일로 주고받으므로 앞 단계를 다시 돌리지 않고 뒤 단계만 다시 실행할 수 있다. `npm start`는 세 단계를 차례로 실행한다.

| 스크립트 | 진입점 | 입력 → 출력 | LLM |
| --- | --- | --- | --- |
| `npm run agent` | `src/agent.ts` | 사이트 → `output/terms.json` (약관 원문) | `AGENT_LLM_*` |
| `npm run extract` | `src/extract-list.ts` | `output/terms.json` → `data/mvno-list.json`, `data/alias-cache.json` | `ALIAS_LLM_*` |
| `npm run markdown` | `src/markdown.ts` | `data/mvno-list.json` → `ktoa_alias`를 넣은 `data/mvno-list.json`, `data/mvno-list.md`, `README.md` 최상단 링크 | 없음 |

1. [agent] browser-use로 통신사별 `알뜰폰 개인정보 제3자 제공동의` 약관 원문을 수집한다. (아래 "약관 수집")
2. [extract] 약관 원문에서 LLM으로 회사명(`mvno_name`)과 브랜드명(`mvno_alias[0]`)을 추출하고, 모든 이름이 원문에 있는지 코드로 대조한다. (아래 "약관 추출")
3. [extract] LLM에 `회사명(브랜드명)`의 약칭, 별칭, alias 목록을 질의해 `mvno_alias`에 추가한다. (아래 "별칭 보강")
4. [markdown] KTOA 표기(회사명 + `KT|SKT|LGT`)를 `ktoa_alias`에 넣고 markdown 표를 만든다. (아래 "KTOA 별칭")
5. JSON과 markdown 표를 GitHub repo에 커밋한다.

## 구현

TypeScript와 Node.js(ESM, Node 22.18+)와 npm `browser-use` 패키지(Python browser-use의 비공식 TypeScript 포트)로 구현한다. LLM은 에이전트용과 별칭용을 따로 설정하며, 각각 Anthropic, OpenAI, OpenAI 호환 API(SiliconFlow 등) 중에서 고른다.

| 파일 | 역할 |
| --- | --- |
| `src/types.ts` | 공통 데이터 타입 (`Mvno`, `MnoEntry`, `TermsRecord`) |
| `src/agent.ts` | `npm run agent`: 에이전트 실행, 약관 원문 수집 |
| `src/extract-list.ts` | `npm run extract`: 약관 추출 → 통신사 대조 → 별칭 보강 → `data/mvno-list.json` 기록 |
| `src/paths.ts` | 단계 사이 파일 경로 (`TERMS_PATH` 등) |
| `src/llm-config.ts` | LLM 환경변수 해석 (상속, 필수값 검사, 구 키 감지) |
| `src/save-terms.ts` | `save_terms` 커스텀 액션 |
| `src/extract.ts` | LLM 약관 추출과 원문 대조 |
| `src/mvno-list.ts` | 통신사별 추출 결과 → 출력 JSON, 실패 모으기 |
| `src/llm.ts` | LLM 설정 → AI SDK 모델 (추출·별칭 공유) |
| `src/aliases.ts` | LLM 별칭 질의와 캐시 |
| `src/ktoa.ts` | KTOA 표기 별칭 계산 |
| `src/markdown.ts` | `npm run markdown`: `ktoa_alias` 추가, JSON → markdown 표 |
| `test/extract.test.ts` | 원문 대조(실제 약관 원문 `test/fixtures/`), 추출 재시도 (mock 모델) |
| `test/save-terms.test.ts` | 통신사명 해석, 원문 후보 선택 |
| `test/mvno-list.test.ts` | 출력 JSON 생성, 검증 |
| `test/aliases.test.ts` | 별칭 병합과 스키마 불일치 재시도 테스트 (mock 모델, 네트워크 호출 없음) |
| `test/llm-config.test.ts` | LLM 환경변수 해석 테스트 |
| `test/ktoa.test.ts` | KTOA 별칭 테스트 |
| `test/markdown.test.ts` | markdown 표 생성 테스트 |

```sh
npm install
npx playwright install chromium
npm test

# 에이전트·별칭 모두 Anthropic (기본)
AGENT_LLM_API_KEY=... npm start   # agent → extract → markdown

# 단계별 실행
AGENT_LLM_API_KEY=... npm run agent     # output/terms.json
AGENT_LLM_API_KEY=... npm run extract   # data/mvno-list.json
npm run markdown                        # ktoa_alias, data/mvno-list.md

# 에이전트는 Anthropic, 별칭은 SiliconFlow
AGENT_LLM_API_KEY=... \
ALIAS_LLM_PROVIDER=openai-compatible \
ALIAS_LLM_MODEL=Qwen/Qwen3-32B \
ALIAS_LLM_API_KEY=... \
ALIAS_LLM_BASE_URL=https://api.siliconflow.com/v1 \
npm start
```

### `.env`

- `npm run agent|extract|markdown`은 Node의 `--env-file-if-exists=.env`로 프로젝트 루트의 `.env`를 읽는다. 파일이 없으면 건너뛴다. (Docker 이미지와 CI에는 `.env`가 없다)
- 셸이나 CI에 이미 설정된 환경변수가 `.env`보다 우선한다.
- `npm test`는 `.env`를 읽지 않는다. 테스트는 환경변수에 의존하지 않는다.
- browser-use도 import 시 `dotenv`로 현재 디렉터리의 `.env`를 읽는다. 위 플래그와 같은 파일이며, 이미 설정된 값을 덮어쓰지 않는다.
- `.env`의 `BROWSER_USE_HEADLESS`는 로컬 실행에도 적용된다.

### LLM 환경변수

LLM 관련 환경변수는 `src/llm-config.ts`에서만 읽는다. 빈 문자열은 미설정으로 본다. 에러 메시지와 로그에는 API 키 값을 넣지 않는다.

에이전트용 (browser-use 크롤링)

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `AGENT_LLM_PROVIDER` | `anthropic` | `anthropic` \| `openai` \| `openai-compatible` |
| `AGENT_LLM_MODEL` | `claude-opus-5-5` (`anthropic`일 때만) | 에이전트 모델. 다른 공급사는 필수 |
| `AGENT_LLM_API_KEY` | (필수) | 에이전트 공급사 API 키 |
| `AGENT_LLM_BASE_URL` | (없음) | `openai-compatible`이면 필수. 예: `https://api.siliconflow.com/v1` |

별칭·약관 추출용 (`src/aliases.ts`, `src/extract.ts`)

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `ALIAS_LLM_PROVIDER` | 에이전트 설정 상속 | 값은 `AGENT_LLM_PROVIDER`와 같다 |
| `ALIAS_LLM_MODEL` | 에이전트 설정 상속 | 별칭 질의 모델 |
| `ALIAS_LLM_API_KEY` | 에이전트 설정 상속 | 별칭 공급사 API 키 |
| `ALIAS_LLM_BASE_URL` | 에이전트 설정 상속 | `openai-compatible`이면 필수 |

- 상속: `ALIAS_LLM_PROVIDER`가 비어 있으면 `ALIAS_LLM_*` 네 값을 모두 `AGENT_LLM_*`에서 가져온다. 지정되면 상속하지 않고 `ALIAS_LLM_*`만 쓴다. 공급사가 다른데 다른 공급사의 API 키나 base URL이 섞이지 않게 하기 위함이다.
- 공급사별 구현: 에이전트는 `anthropic`이면 browser-use `ChatAnthropic`, `openai`/`openai-compatible`이면 browser-use `ChatOpenAI`에 `baseURL`을 넘긴다. 별칭은 Vercel AI SDK의 `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`을 쓴다.
- 시작할 때 두 설정을 모두 검사해, 잘못되었으면 크롤링 전에 실패한다.
- 제거한 키: `ANTHROPIC_API_KEY` → `AGENT_LLM_API_KEY`, `LLM_MODEL` → `AGENT_LLM_MODEL`, `ALIAS_MODEL` → `ALIAS_LLM_MODEL`. 구 키가 설정되어 있고 대응하는 새 키가 비어 있으면 새 키 이름을 알려주며 즉시 실패한다. (조용히 기본 모델로 도는 일이 없게)

### 그 외 환경변수

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `START_URL` | 아래 최초url | 크롤링 시작 url |
| `ALIAS_REFRESH` | `false` | `true`면 캐시를 무시하고 전부 다시 질의 |
| `MAX_STEPS` | `60` | 에이전트 최대 step |
| `TERMS_PATH` | `output/terms.json` | 수집한 약관 원문 |
| `OUTPUT_PATH` | `data/mvno-list.json` | 배포할 JSON |
| `MARKDOWN_PATH` | `data/mvno-list.md` | 배포할 markdown 표 |
| `ALIAS_CACHE_PATH` | `data/alias-cache.json` | LLM 별칭 캐시 |
| `BROWSER_USE_HEADLESS` | 자동 | `true`면 헤드리스 |

## 로컬 실행 (Docker Compose)

로컬 실험용이다. 정기 실행은 아래 GitHub Actions가 맡는다.

```sh
cp .env.example .env        # 값 채우기 (최소 AGENT_LLM_API_KEY)
docker compose build
docker compose run --rm app                       # headless로 npm start (agent → extract → markdown)
docker compose run --rm app npm run extract       # 수집한 약관(output/terms.json)으로 추출만 다시
docker compose run --rm --service-ports headful   # headful. 화면: http://localhost:6080/vnc.html?autoconnect=1&resize=scale
docker compose run --rm app npm test
docker compose run --rm app npm run markdown      # 기존 JSON에서 ktoa_alias와 markdown 표만 다시 생성
```

- 이미지: `mcr.microsoft.com/playwright:v1.64.1-noble` (Node 24, Chromium 포함). Playwright를 올리면 `Dockerfile`의 이미지 태그도 같은 버전으로 올린다.
- `.env`는 `env_file`로 주입한다. 키 목록과 설명은 `.env.example`에 있다.
- `data/`, `output/`은 호스트에 마운트되어 결과물(`mvno-list.json`, `alias-cache.json`, `terms.json`)을 바로 볼 수 있다.
- `src/`, `docs/`, `test/`도 마운트되므로 코드나 프롬프트를 고쳐도 다시 빌드할 필요가 없다. `package.json`이 바뀌면 다시 빌드한다.
- headless / headful
  - `app` 서비스는 `.env`의 `BROWSER_USE_HEADLESS`를 따른다. 비어 있거나 없으면 headless다.
  - `headful` 서비스는 항상 `BROWSER_USE_HEADLESS=false`로 돈다. `app`에 `-e BROWSER_USE_HEADLESS=false`를 주는 것과 같지만 포트가 미리 잡혀 있다.
  - headful이면 `docker/entrypoint.sh`가 가상 디스플레이(Xvfb, `SCREEN_SIZE`)를 띄우고 x11vnc → noVNC로 6080 포트에 내보낸다. 호스트 브라우저에서 위 주소로 연다.
  - `docker compose run`은 기본적으로 포트를 열지 않으므로 `--service-ports`가 필요하다.
  - VNC에 비밀번호가 없으므로 포트는 `127.0.0.1`에만 연다.
  - browser-use는 `BROWSER_USE_HEADLESS=""`(빈 값)를 headful로 읽는다. 이 프로젝트는 빈 값을 미설정으로 보므로, entrypoint에서 빈 값을 `true`로 고정한다.
  - 에이전트가 끝나면 브라우저도 닫힌다.
- 호스트에서 `npm start`로 실행하면 browser-use가 화면 유무를 감지해 정한다. (macOS에서는 headful)

## 크롤링

최초url: https://sign-service.inicis.com/sample/request.php?reqSvcCd=03
다음부터는 환경변수(`START_URL`)로 정한다.

`browser-use-prompt.md`를 browser-use에게 주입해 크롤링을 수행한다. 시작 url 이동은 프롬프트가 아니라 `initial_actions`로 처리한다.

## 약관 수집 (`save_terms` 커스텀 액션)

browser-use `Agent`는 `done` 액션으로 결과를 한 번만 반환하므로, 프롬프트 중간의 약관은 커스텀 액션으로 수집한다. 특정 사이트의 요소(id, class)에 의존하지 않는다. (`src/save-terms.ts`)

- `Controller`(= `Tools`)에 `save_terms(carrier: string)` 액션을 등록한다.
- 약관은 길 수 있으므로 LLM이 본문을 인자로 넘기지 않는다. 액션이 화면에서 원문을 직접 읽는다.
  - 열린 모든 탭과 frame에서 원문 후보를 모은다.
    - `overlay`: 화면 위에 뜬 요소(`<dialog>`, `role="dialog"`, `aria-modal="true"`, `position: fixed`)의 텍스트
    - `frame` / `page`: frame 또는 탭 전체 텍스트. 약관이 iframe이나 새 탭으로 열리거나 overlay로 잡히지 않을 때를 위한 것
  - "알뜰폰"이 들어 있는 후보 중 주제어("알뜰폰", "제3자", "제공")가 많은 것 → `overlay` 우선 → 짧은 것 순으로 하나를 고른다.
- 통신사는 에이전트가 넘긴 `carrier`(예: "알뜰폰 KT")로 정한다. 알 수 없는 값이면 에러를 반환한다. 약관 원문에 적힌 통신사와의 대조는 extract 단계가 한다.
- 사업자 추출은 하지 않는다. 그래서 엉뚱한 화면을 읽어도 이 단계에서는 알 수 없고, extract 단계에서 "약관이 아님"으로 실패한다. 그때는 `npm run agent`를 다시 실행한다.
- 수집 결과는 `{carrier, mno, text, source, url, fetched_at}` 형태로 mno를 키로 저장한다. 같은 통신사를 다시 저장하면 덮어쓴다. 호출 즉시 `TERMS_PATH`에도 기록해 중간에 실패해도 남도록 한다.
- 액션은 짧은 확인 메시지(`saved <mno> (<source>, <n> chars)`)만 반환해 에이전트 LLM 컨텍스트에 약관 본문이 들어가지 않게 한다.
- 프롬프트에서는 "return" 대신 `save_terms` 호출을 지시하고, 마지막 단계에서만 `done`을 호출하게 한다.

## 약관 추출

약관의 형식이나 문구는 바뀔 수 있으므로 정규식으로 파싱하지 않고 LLM으로 추출한다. 지어낸 이름은 코드로 원문과 대조해 막는다. (`src/extract.ts`)

- 모델: 별칭 보강과 같은 `ALIAS_LLM_*` 설정을 쓴다.
- 약관 원문 전체를 주고 structured output으로 받는다: `{is_mvno_terms, mno: "SKT"|"KT"|"LG U+"|null, mvnos: [{mvno_name, brand_name|null}]}`
- 법인 표기(`㈜`, `(주)`, `주식회사`, `유한회사` 등) 제거는 LLM이 한다. 프롬프트로 "법인 표기만 빼고 나머지 글자는 바꾸지 않는다"를 지시하며, 코드는 정규식으로 지우지 않는다. 표기 종류를 코드에 나열하지 않아도 되도록 하기 위함이다.
- 원문 대조: 모든 `mvno_name`과 `brand_name`이 원문에 그대로 있어야 한다. 공백, 대소문자 차이만 무시한다. 법인 표기를 뺀 이름은 원문 표기의 일부이므로 그대로 대조된다. 하나라도 없으면 다시 질의한다.
- 스키마 불일치나 원문 대조 실패는 1회 재시도하고, 그래도 실패하면 그 통신사는 실패다.
- 통신사 대조: 원문에서 읽은 통신사가 있고 에이전트가 고른 통신사(`terms.json`의 키)와 다르면 실패다. 원문에서 알 수 없으면 에이전트가 고른 통신사를 쓴다.
- 한 통신사라도 실패하면 `data/mvno-list.json`을 쓰지 않고 종료한다. (기존 배포본을 덮어쓰지 않기 위함)
- `is_mvno_terms`가 false면 재시도하지 않는다. 다른 화면을 읽은 경우이므로 `npm run agent`부터 다시 해야 한다.
- 정리: 코드는 공백만 정리한다. LLM이 준 회사명이 `mvno_name`, 브랜드명이 있고 회사명과 다르면 `mvno_alias[0]`이다. 같은 회사가 여러 번 나오면 합친다.
- 한계: LLM이 법인 표기를 남기거나(예: `드림라인㈜`) 회사명 일부까지 지우면 그대로 출력된다. 원문 대조는 원문에 있는 글자인지만 보므로 이를 잡지 못한다.
- 한계: 원문 대조는 없는 이름을 지어내는 것은 막지만, 원문에 있는 사업자를 빠뜨리는 것은 막지 못한다. 프롬프트로 "빠짐없이"를 요구하는 것이 전부다.

## 별칭 보강

Vercel AI SDK(`ai`)의 `generateObject`로 `ALIAS_LLM_*` 설정의 공급사에 질의한다. (`src/aliases.ts`)

- MNO별로 한 번씩, 캐시에 없는 사업자만 `회사명(브랜드명)` 목록으로 묶어 질의한다.
- 질의 내용: 알뜰폰 브랜드명, 약칭, 별칭, 영문 표기, 이전 브랜드명. 법인 표기는 붙이지 않게 하고, 확실하지 않은 이름, 법인 표기만 다른 이름, 알뜰폰과 무관한 계열사 이름은 제외하게 한다.
- 응답은 zod 스키마(`{items: [{mvno_name, aliases}]}`)로 받는다. 목록에 없는 `mvno_name`은 버린다.
- 응답이 스키마와 맞지 않으면 1회 다시 질의하고, 그래도 맞지 않으면 실행을 실패로 처리한다. API 호출 오류(네트워크, 429 등)는 AI SDK 기본 재시도를 따른다.
- 병합: `mvno_alias = [약관 브랜드명, ...LLM 별칭]`. 중복과 회사명과 같은 값은 뺀다. 법인 표기는 LLM이 붙이지 않게 하며 코드는 지우지 않는다.
- 캐시: 질의 결과를 `data/alias-cache.json`에 `회사명(브랜드명)`을 키로 저장하고 repo에 커밋한다.
  - LLM 응답은 실행마다 달라질 수 있다. 캐시가 없으면 매달 JSON이 바뀌어 불필요한 커밋이 생기므로, 새로 생긴 사업자만 질의한다.
  - 약관의 회사명이나 브랜드명이 바뀌면 키가 달라져 다시 질의한다.
  - 캐시에 잘못된 별칭이 있으면 파일을 직접 고친다. 전부 다시 받으려면 `ALIAS_REFRESH=true`로 실행한다.
- LLM 별칭은 검증되지 않은 값이다. 소비하는 쪽에서 `mvno_alias[0]` 외에는 참고용으로 다룬다.

## KTOA 별칭

한국통신사업자연합회(KTOA) 표기처럼 회사명 뒤에 통신사 표기를 괄호 없이 붙인 별칭(예: `KCTSKT`)을 각 MVNO의 `ktoa_alias` 키(markdown 표에서는 `ktoa_alias` 칸)에 넣는다. `mvno_alias`에는 넣지 않는다. (`src/ktoa.ts`)

- 통신사 표기: `SKT` → `SKT`, `KT` → `KT`, `LG U+` → `LGT`
- 회사명과 mno만으로 정해지므로 LLM에 질의하지 않고, 별칭 캐시에도 넣지 않는다.
- 여러 번 실행해도 결과가 같다. 기존 `ktoa_alias` 값은 덮어쓴다.
- markdown 단계(`npm run markdown`)에서 넣는다. 크롤링·LLM 없이 기존 `data/mvno-list.json`에 다시 적용할 수 있다.

참고: 같은 페이지의 `알뜰폰(이동통신사) 확인하기` 버튼 팝업에도 통신사별 알뜰폰 목록이 `회사명(브랜드명)` 형태로 있다. 약관 목록과 구성이 다르다. (예: SKT에 토스모바일 포함, LG U+ 목록이 더 김)

## 정기 실행 (GitHub Actions)

매달 2일 GitHub Actions로 위 처리 흐름 전체를 실행한다.

- 트리거
  - `schedule`: `cron: "0 0 2 * *"` (UTC 기준 매달 2일 00:00, KST 09:00)
  - `workflow_dispatch`: 수동 실행용
- 실행 단계
  1. 저장소 체크아웃, Node.js 및 의존성 설치(`npm ci`), Chromium 설치, 타입 검사(`npm run typecheck`), 테스트
  2. 크롤링 → 약관 수집 → JSON 생성 (`BROWSER_USE_HEADLESS=true`)
  3. `data/` 내용이 이전과 달라졌을 때만 `mvno-list.json`, `mvno-list.md`, `alias-cache.json`, `README.md`를 커밋/푸시한다.
  4. 수집한 약관 원문 JSON은 workflow artifact로 업로드해 디버깅에 쓴다.
- workflow: `.github/workflows/monthly.yml`
- 환경변수 / Secrets
  - repository variables: `START_URL`, `AGENT_LLM_PROVIDER`, `AGENT_LLM_MODEL`, `AGENT_LLM_BASE_URL`, `ALIAS_LLM_PROVIDER`, `ALIAS_LLM_MODEL`, `ALIAS_LLM_BASE_URL` (LLM 값은 비우면 기본값 또는 상속)
  - secrets: `AGENT_LLM_API_KEY`, `ALIAS_LLM_API_KEY` (별칭이 에이전트 설정을 상속하면 비워 둔다)
  - 비어 있는 variable/secret은 빈 문자열로 넘어오며, `llm-config.ts`가 미설정으로 처리한다.
  - repo 커밋 권한: workflow에 `permissions: contents: write`를 준다.
- 실패 처리
  - 수집된 통신사 수가 3개 미만이거나 MVNO 목록이 비어 있으면 실패로 처리하고 배포하지 않는다. (기존 배포본을 빈 데이터로 덮어쓰지 않기 위함)
