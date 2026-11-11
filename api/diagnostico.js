"use strict";
const llm = require("../lib/llm");

// GET /api/diagnostico            -> qué proveedor está configurado (sin mostrar claves)
// GET /api/diagnostico?probar=1   -> además hace una llamada de prueba al modelo
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const url = new URL(req.url, "http://x");
    res.statusCode = 200; res.end(JSON.stringify(await llm.diagnosticar(url.searchParams.get("probar") === "1"), null, 2));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e && e.message || e).slice(0, 200) })); }
};
