export interface YouGlishTarget {
  language: string;
  region?: string;
}

export interface PronunciationLinks {
  word: string;
  youglishUrl: string;
  forvoUrl: string;
}

export function normalizePronunciationWord(word: string): string {
  return word.trim().replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, '');
}

export function inferYouGlishTarget(lang?: string): YouGlishTarget | null {
  const normalizedLang = lang?.toLowerCase();
  if (!normalizedLang) return null;

  if (normalizedLang === 'fr' || normalizedLang.startsWith('fr-')) {
    return { language: 'french', region: 'fr' };
  }

  if (normalizedLang === 'en-us') return { language: 'english', region: 'us' };
  if (normalizedLang === 'en-gb') return { language: 'english', region: 'uk' };
  if (normalizedLang === 'en' || normalizedLang.startsWith('en-')) {
    return { language: 'english', region: 'us' };
  }

  if (normalizedLang === 'es' || normalizedLang.startsWith('es-')) return { language: 'spanish' };
  if (normalizedLang === 'de' || normalizedLang.startsWith('de-')) return { language: 'german' };
  if (normalizedLang === 'it' || normalizedLang.startsWith('it-')) return { language: 'italian' };

  if (normalizedLang === 'pt-br') return { language: 'portuguese', region: 'br' };
  if (normalizedLang === 'pt-pt') return { language: 'portuguese', region: 'pt' };
  if (normalizedLang === 'pt' || normalizedLang.startsWith('pt-')) return { language: 'portuguese' };

  return null;
}

export function buildPronunciationLinks(word: string, voiceLang?: string): PronunciationLinks | null {
  const normalizedWord = normalizePronunciationWord(word);
  if (!normalizedWord) return null;

  const encodedWord = encodeURIComponent(normalizedWord);
  const youglishTarget = inferYouGlishTarget(voiceLang);
  const youglishPath = youglishTarget
    ? `/${youglishTarget.language}${youglishTarget.region ? `/${youglishTarget.region}` : ''}`
    : '';

  return {
    word: normalizedWord,
    youglishUrl: `https://youglish.com/pronounce/${encodedWord}${youglishPath}`,
    forvoUrl: `https://pt.forvo.com/search/${encodedWord}/`,
  };
}
