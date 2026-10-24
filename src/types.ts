// 프로젝트 전반에서 쓰는 데이터 모양

export interface Mvno {
  mvno_name: string;
  mvno_alias: string[];
  // KTOA 표기: 회사명 + KT|SKT|LGT (예: KCTSKT). 추출 직후에는 없고 addKtoaAliases가 채운다.
  ktoa_alias?: string;
}

// 출력 JSON(data/mvno-list.json)의 한 항목
export interface MnoEntry {
  mno: string;
  mvnos: Mvno[];
}

export type MvnoList = MnoEntry[];

// 출력 JSON 파일(data/mvno-list.json) 전체
export interface MvnoListFile {
  mnos: MvnoList;
  // 약관을 수집한 시각 (ISO 8601, UTC). 통신사별 수집 시각 중 가장 늦은 것. 모르면 null
  fetched_at: string | null;
}

// save_terms가 저장하는 약관 원문(TERMS_PATH). mno를 키로 쓴다.
export interface TermsRecord {
  carrier: string;
  mno: string;
  text: string;
  // 원문을 읽은 곳 (overlay | frame | page)
  source: string;
  url: string;
  fetched_at: string;
}

export type TermsByMno = Partial<Record<string, TermsRecord>>;
