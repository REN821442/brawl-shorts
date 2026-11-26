// Actualizează data/shorts.json cu shorturile noi ale canalelor din channels.json.
// Rulează cu Node 20+ (fără dependențe):  node scripts/update.mjs
// Opțional: variabila YOUTUBE_API_KEY aduce TOATE shorturile + durata; fără ea se folosește RSS (ultimele ~15 pe canal).
import { readFile, writeFile, mkdir } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url);
const CH_FILE = new URL("channels.json", ROOT);
const DATA_FILE = new URL("data/shorts.json", ROOT);
const KEY = process.env.YOUTUBE_API_KEY || "";
const UA = { "User-Agent": "Mozilla/5.0 (brawl-shorts-updater)", "Accept-Language": "en" };

const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function resolveChannelId(ch) {
  if (ch.channelId) return ch.channelId;
  const handle = ch.handle.startsWith("@") ? ch.handle : "@" + ch.handle;
  const html = await (await fetch(`https://www.youtube.com/${handle}`, { headers: UA })).text();
  const m = html.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/) || html.match(/channel\/(UC[\w-]{22})/);
  if (!m) throw new Error(`Nu găsesc ID-ul canalului pentru ${handle}`);
  ch.channelId = m[1];
  return ch.channelId;
}

function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: e.match(/<yt:videoId>([^<]+)/)?.[1],
    title: decode(e.match(/<title>([^<]*)/)?.[1] || ""),
    date: (e.match(/<published>([^<]+)/)?.[1] || "").slice(0, 10),
    views: +(e.match(/views="(\d+)"/)?.[1] || 0),
  })).filter(v => v.id);
}

async function isShort(id) {
  const r = await fetch(`https://www.youtube.com/shorts/${id}`, { method: "HEAD", redirect: "manual", headers: UA });
  return r.status === 200;
}

async function viaRss(cid) {
  // Playlistul „UUSH…” conține doar shorturile canalului.
  const shortsFeed = `https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${cid.slice(2)}`;
  let r = await fetch(shortsFeed, { headers: UA });
  if (r.ok) {
    const items = parseFeed(await r.text());
    if (items.length) return items;
  }
  // Rezervă: feedul canalului, păstrăm doar ce e short.
  r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`, { headers: UA });
  if (!r.ok) throw new Error(`RSS ${r.status}`);
  const out = [];
  for (const v of parseFeed(await r.text())) if (await isShort(v.id)) out.push(v);
  return out;
}

const isoDur = d => {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
  const s = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

async function viaApi(cid, max = 500) {
  const api = (path, q) => fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...q, key: KEY })}`).then(r => r.json());
  const ids = [];
  let pageToken = "";
  do {
    const j = await api("playlistItems", { part: "contentDetails", playlistId: "UUSH" + cid.slice(2), maxResults: 50, ...(pageToken && { pageToken }) });
    if (j.error) throw new Error(j.error.message);
    ids.push(...j.items.map(i => i.contentDetails.videoId));
    pageToken = j.nextPageToken || "";
  } while (pageToken && ids.length < max);
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await api("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") });
    for (const v of j.items || []) out.push({
      id: v.id, title: v.snippet.title, date: v.snippet.publishedAt.slice(0, 10),
      views: +(v.statistics.viewCount || 0), dur: isoDur(v.contentDetails.duration),
    });
  }
  return out;
}

const channels = JSON.parse(await readFile(CH_FILE, "utf8"));
let data = { updated: "", shorts: [] };
try { data = JSON.parse(await readFile(DATA_FILE, "utf8")); } catch {}
const byId = new Map(data.shorts.map(s => [s.id, s]));
let added = 0, errors = 0;

for (const ch of channels) {
  try {
    const cid = await resolveChannelId(ch);
    const items = KEY ? await viaApi(cid) : await viaRss(cid);
    for (const v of items) {
      const old = byId.get(v.id);
      if (!old) added++;
      byId.set(v.id, { ...old, ...v, ck: ch.key, views: v.views || old?.views || 0, dur: v.dur || old?.dur || "" });
    }
    console.log(`${ch.name}: ${items.length} shorturi citite`);
  } catch (e) {
    errors++;
    console.error(`${ch.name}: eroare – ${e.message}`);
  }
}

const keys = new Set(channels.map(c => c.key));
const shorts = [...byId.values()].filter(s => keys.has(s.ck)).sort((a, b) => b.date.localeCompare(a.date));
await mkdir(new URL("data/", ROOT), { recursive: true });
await writeFile(DATA_FILE, JSON.stringify({ updated: new Date().toISOString(), shorts }, null, 1));
await writeFile(CH_FILE, JSON.stringify(channels, null, 2) + "\n");
console.log(`Gata: ${shorts.length} shorturi în total, ${added} noi.`);
if (errors === channels.length) process.exit(1);
