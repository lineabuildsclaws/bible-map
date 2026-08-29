const STEP_BIBLE_URL = 'https://www.stepbible.org/';

function stepBibleReference(reference: string): string {
  const match = reference.trim().match(/^(.+?)\s+(\d+):(.+)$/);
  if (!match) return reference.trim();

  const [, book, chapter, verse] = match;
  return `${book}.${chapter}.${verse}`;
}

export function bibleReferenceUrl(reference: string): string {
  const passage = encodeURIComponent(stepBibleReference(reference));
  return `${STEP_BIBLE_URL}?q=reference=${passage}%7Cversion=ESV&skipwelcome`;
}
