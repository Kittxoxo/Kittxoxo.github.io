const crypto = require("crypto");

const bits = (m) => { let c = 0; while (m) { c += m & 1; m >>>= 1; } return c; };
const hid = (pid) => crypto.createHash("sha1").update(pid).digest("hex").slice(0, 10);

function parsePlayers(flat) {
  const out = [];
  for (let k = 0; k + 1 < (flat || []).length; k += 2) {
    let v = {};
    try { v = JSON.parse(flat[k + 1]); } catch (e) {}
    out.push({ pid: flat[k], name: v.n || "Player", mask: v.m || 0, t: v.t || 0, count: bits(v.m || 0) });
  }
  return out;
}

// most boxes first; if tied, whoever got there first. A full card (24) therefore ranks by finishing time.
const rank = (players) =>
  players.slice().sort((a, b) => b.count - a.count || a.t - b.t || a.name.localeCompare(b.name));

module.exports = { bits, hid, parsePlayers, rank };
