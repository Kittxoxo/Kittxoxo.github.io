// Tiny endpoint, no database: phones use it to line their clocks up with the server.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ now: Date.now() });
};
