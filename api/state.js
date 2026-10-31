const { pipe } = require("./_redis");

module.exports = async (req, res) => {
  // Cached for 2s at Vercel's edge so 100 phones polling = ~1 database read per 2s.
  res.setHeader("Cache-Control", "public, s-maxage=2, stale-while-revalidate=3");
  try {
    const [[st, pr], photos] = await pipe([
      ["MGET", "hb:state", "hb:prompts"],
      ["LLEN", "hb:photos"],
    ]);
    const state = st ? JSON.parse(st) : { status: "waiting" };
    res.status(200).json({
      status: state.status,
      startedAt: state.startedAt || null,
      duration: state.duration || 600000,
      resetAt: state.resetAt || 0,
      showcase: state.showcase || { open: false, rank: 1 },
      prompts: pr ? JSON.parse(pr) : null,
      photos: photos || 0,
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: "server" });
  }
};
