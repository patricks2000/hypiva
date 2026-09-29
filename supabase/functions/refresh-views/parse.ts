// Reads the view count and the account name from a TikTok video page.
export interface VideoStats { views: number; author: string | null }

export function parseTikTokPage(html: string): VideoStats | null {
  const m = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      const item = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
      const raw = item?.statsV2?.playCount ?? item?.stats?.playCount;
      const views = Number(raw);
      if (item && Number.isFinite(views) && views >= 0) return { views, author: item.author?.uniqueId ?? null };
    } catch { /* fall through to the plain search */ }
  }
  const play = html.match(/"playCount":"?(\d+)"?/);
  if (!play) return null;
  const author = html.match(/"uniqueId":"([^"]+)"/);
  return { views: Number(play[1]), author: author ? author[1] : null };
}

export const sameAccount = (a: string | null, b: string) =>
  !a || a.replace(/^@/, '').toLowerCase() === b.replace(/^@/, '').toLowerCase();
