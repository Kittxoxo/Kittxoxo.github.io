// Public: small thumbnails for the end-of-game collage, one page at a time.
const { cmd } = require("./_redis");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
  try {
    const cursor = Math.max(0, parseInt(req.query.cursor, 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const ids = await cmd(["LRANGE", "hb:photos", cursor, cursor + limit - 1]);
    if (!ids.length) return res.status(200).json({ items: [], next: null });
    const vals = await cmd(["MGET", ...ids.map((id) => "hb:t:" + id)]);
    const items = ids.map((id, k) => ({ id, src: vals[k] })).filter((x) => x.src);
    res.status(200).json({ items, next: ids.length === limit ? cursor + limit : null });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: "server" });
  }
};
