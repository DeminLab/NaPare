const INTERNAL_ORIGIN = 'https://napare.invalid';

export function getInternalHref(value?: string): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return null;
    const legacyLesson=url.pathname.match(/^\/(?:student\/)?lesson\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if(legacyLesson)url.pathname='/pair-space/'+legacyLesson[1];
    if(url.pathname==='/student')url.pathname='/';
    else if(url.pathname.startsWith('/student/'))url.pathname=url.pathname.slice('/student'.length);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
