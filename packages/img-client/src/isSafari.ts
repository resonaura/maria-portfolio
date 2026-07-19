/**
 * True for actual Safari (desktop or iOS) — every other iOS browser (Chrome,
 * Firefox, Edge) is WebKit under the hood too and carries "Safari" in its UA
 * string, but tags itself with CriOS/FxiOS/EdgiOS, and desktop Chrome/Edge/Opera
 * all carry both "Safari" and "Chrome". Excluding those first is the standard
 * way to isolate real Safari from UA string alone.
 */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|opr|android/i.test(ua);
}
