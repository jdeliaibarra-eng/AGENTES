"use strict";
const servicio = require("../lib/servicio");

// GET /api/bitacora?sesion=...  → bitácora de esa sesión en CSV
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const url = new URL(req.url, "http://x");
    const csv = await servicio.csv(url.searchParams.get("sesion"));
    res.statusCode = 200; res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.end(csv);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error("[api/bitacora]", e);
    res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: status === 500 ? "Error interno del servidor." : e.message }));
  }
};
