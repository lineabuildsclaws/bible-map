const BIBLE_GATEWAY_PASSAGE_URL = 'https://www.biblegateway.com/passage/';

export function bibleReferenceUrl(reference: string): string {
  const url = new URL(BIBLE_GATEWAY_PASSAGE_URL);
  url.searchParams.set('search', reference);
  url.searchParams.set('version', 'ESV');
  return url.href;
}
