// Relais Cloudflare Worker : laisse le visualiseur (GitHub Pages) lire un rapport anti-jeu joint sur Discord, dont le CDN
// n'envoie pas d'en-tête CORS. Ne relaie QUE les rapports (cdn.discordapp.com/attachments/…-rapport.ndjson.gz), ne stocke rien.
// Usage : GET https://<worker>/?u=<lien du fichier Discord, encodé>
const PAGE_ORIGIN = "https://luclyoko.github.io";
const MAX_BYTES = 30 * 1024 * 1024;

export default {
  async fetch(req) {
    const cors = {"Access-Control-Allow-Origin": PAGE_ORIGIN, "Vary": "Origin"};
    const reply = (status, text) => new Response(text, {status, headers: {...cors, "Content-Type": "text/plain; charset=utf-8"}});
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: {...cors, "Access-Control-Allow-Methods": "GET"}});
    if (req.method !== "GET") return reply(405, "Méthode refusée");

    let target;
    try { target = new URL(new URL(req.url).searchParams.get("u")); } catch { return reply(400, "Lien manquant ou invalide"); }
    if (target.protocol !== "https:" || target.hostname !== "cdn.discordapp.com" || !target.pathname.startsWith("/attachments/")
      || !target.pathname.endsWith("-rapport.ndjson.gz")) return reply(400, "Seuls les rapports anti-jeu joints sur Discord sont relayés");

    const res = await fetch(target.href, {headers: {"User-Agent": "antijeu-relay"}});
    if (!res.ok) return reply(res.status, "Discord a répondu " + res.status);
    if (Number(res.headers.get("Content-Length") || 0) > MAX_BYTES) return reply(413, "Fichier trop lourd");
    return new Response(res.body, {headers: {...cors, "Content-Type": "application/gzip", "Cache-Control": "no-store"}});
  },
};
