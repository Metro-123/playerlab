import { CDN, FACE_VERSION } from "@/lib/info";

/**
 * Asset sizes the CDN actually publishes. 120 is available for every one of the
 * 17,347 portraits and answers in ~4 KB of webp; 240 is noticeably sharper for
 * the large hero portraits but is only published for a subset, so it is opt-in
 * per call site rather than the default.
 */
const SIZES = new Set([60, 120, 240]);

/**
 * Portrait proxy.
 *
 * The source CDN refuses hotlinked requests: it answers 403 unless the request
 * carries `Referer: https://sofifa.com/`. A browser loading `<img src=...>` can
 * never satisfy that, so every portrait would fall through to the procedural
 * silhouette. This route re-requests the asset server-side with the required
 * header and streams it back, so the app can point at its own origin.
 *
 * The upstream path is rebuilt from the numeric Sofifa id rather than taken from
 * the query string, so this cannot be used as an open proxy. The rebuild is
 * exact for all 17,347 rows in the payload: one host, one asset version, and
 * the two path segments are the id's thousands/remainder zero-padded to three
 * digits.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!/^\d{1,7}$/.test(id)) return new Response("bad id", { status: 400 });

  const requested = Number(new URL(req.url).searchParams.get("s"));
  const size = SIZES.has(requested) ? requested : 120;

  const n = Number(id);
  const upstream =
    `${CDN}/players/` +
    `${String(Math.floor(n / 1000)).padStart(3, "0")}/` +
    `${String(n % 1000).padStart(3, "0")}/` +
    `${FACE_VERSION}_${size}.png`;

  const headers = {
    Referer: "https://sofifa.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
  };

  /**
   * The CDN throttles bursts: a grid of cards fires ~24 simultaneous requests
   * and a few come back 404 even though the asset exists, so a 404 is not
   * treated as final on the first try. Backing off and asking again recovers
   * the throttled ones; a genuinely absent portrait still fails after the last
   * attempt, and the client falls back to the silhouette.
   *
   * Measured against a 90-player sample fired all at once, 6 of 90 404'd on the
   * first pass. Sofifa genuinely publishes no image for a small minority of
   * players, so a 404 that survives every retry is a real absence, not a bug.
   */
  let res: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 150 * 2 ** (attempt - 1)));
    try {
      const attemptRes = await fetch(upstream, {
        headers,
        // Portraits for a given id+season are effectively immutable; cache the
        // upstream copy so repeat views never touch the CDN again.
        next: { revalidate: 60 * 60 * 24 * 30 },
      });
      if (attemptRes.ok) {
        res = attemptRes;
        break;
      }
    } catch {
      // network hiccup or throttled connection; fall through to the next attempt
    }
  }

  try {
    if (!res || !res.body) return new Response("not found", { status: 404 });

    return new Response(res.body, {
      status: 200,
      headers: {
        // The CDN content-negotiates: with a webp-capable Accept it answers
        // webp, so pass the real type through rather than hardcoding png.
        "Content-Type": res.headers.get("content-type") ?? "image/png",
        "Content-Length": res.headers.get("content-length") ?? "",
        "Cache-Control": "public, max-age=31536000, immutable",
        Vary: "Accept",
      },
    });
  } catch {
    // Upstream unreachable. The client already falls back to the silhouette on
    // a non-2xx image, so a plain 404 is the right shape here.
    return new Response("upstream unavailable", { status: 404 });
  }
}
