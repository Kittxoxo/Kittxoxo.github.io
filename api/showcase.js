// Public, but only returns anything while the host has the winners showcase open.
const { pipe } = require("./_redis");
const { parsePlayers, rank, hid } = require("./_rank");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=2, stale-while-revalidate=3");
  try {
    const [st, flat] = await pipe([["GET", "hb:state"], ["HGETALL", "hb:prog"]]);
    const sc = (st ? JSON.parse(st) : {}).showcase || { open: false, rank: 1 };
    if (!sc.open) return res.status(200).json({ open: false, winners: [] });
    const top = rank(parsePlayers(flat)).filter((p) => p.count > 0).slice(0, 5);
    res.status(200).json({
      open: true,
      rank: sc.rank,
      winners: top.map((p, i) => ({ id: hid(p.pid), name: p.name, count: p.count, mask: p.mask, rank: i + 1 })),
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: "server" });
  }
};
