// The 400px pictures of ONE top-5 player, only while the showcase is open.
const { cmd, pipe } = require("./_redis");
const { parsePlayers, rank, hid } = require("./_rank");

module.exports = async (req, res) => {
  try {
    const [st, flat] = await pipe([["GET", "hb:state"], ["HGETALL", "hb:prog"]]);
    const sc = (st ? JSON.parse(st) : {}).showcase || { open: false };
    if (!sc.open) return res.status(403).json({ error: "closed" });
    const top = rank(parsePlayers(flat)).filter((p) => p.count > 0).slice(0, 5);
    const w = top.find((p) => hid(p.pid) === String(req.query.id || ""));
    if (!w) return res.status(403).json({ error: "not a winner" });
    const idx = [];
    for (let i = 0; i < 25; i++) if (i !== 12 && (w.mask >> i) & 1) idx.push(i);
    if (!idx.length) return res.status(200).json({ items: [] });
    const vals = await cmd(["MGET", ...idx.map((i) => "hb:f:" + w.pid + ":" + i)]);
    res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=20");
    res.status(200).json({ items: idx.map((i, k) => ({ i, src: vals[k] })).filter((x) => x.src) });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: "server" });
  }
};
