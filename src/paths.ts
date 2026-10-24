// 단계 사이에 주고받는 파일 경로
// agent → TERMS_PATH → extract → OUTPUT_PATH(+ALIAS_CACHE_PATH) → markdown → OUTPUT_PATH, MARKDOWN_PATH
export const TERMS_PATH = process.env.TERMS_PATH ?? 'output/terms.json';
export const OUTPUT_PATH = process.env.OUTPUT_PATH ?? 'data/mvno-list.json';
export const MARKDOWN_PATH = process.env.MARKDOWN_PATH ?? 'data/mvno-list.md';
export const ALIAS_CACHE_PATH = process.env.ALIAS_CACHE_PATH ?? 'data/alias-cache.json';
export const README_PATH = process.env.README_PATH ?? 'README.md';
