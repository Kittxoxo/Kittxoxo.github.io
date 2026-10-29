// Public live board: everyone's progress. Ids are hashed so nobody can pose as another player.
const crypto = require("crypto");
const { pipe } = require("./_redis");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=2, stale-while-revalidate=3");
  try {
    const [st, flat, photos] = await pipe([
      ["GET", "hb:state"],
      ["HGETALL", "hb:prog"],
      ["LLEN", "hb:photos"],
    ]);
    const players = [];
    for (let k = 0; k + 1 < (flat || []).length; k += 2) {
      players.push({
        id: crypto.createHash("sha1").update(flat[k]).digest("hex").slice(0, 8),
        mask: parseInt(flat[k + 1], 10) || 0,
      });
    }
    const state = st ? JSON.parse(st) : { status: "waiting" };
    res.status(200).json({ status: state.status, startedAt: state.startedAt || null, duration: state.duration || 600000, players, photos: photos || 0 });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: "server" });
  }
};
