"use strict";
// Conexión a Postgres (Supabase). Una sola conexión por instancia de la función: Vercel crea muchas instancias pequeñas
// y el "pooler" de Supabase se encarga de repartirlas.
const { Pool } = require("pg");

let pool = null;
function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL (cadena de conexión de Supabase).");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000, ssl: local ? false : { rejectUnauthorized: false } });
  pool.on("error", () => { pool = null; });
  return pool;
}

// El catálogo (productos, clientes, lotes, aprobaciones) casi no cambia: se guarda en memoria 60 segundos por instancia.
let cache = { t: 0, tablas: null };
async function leerCatalogo() {
  if (cache.tablas && Date.now() - cache.t < 60000) return cache.tablas;
  const p = getPool();
  const q = (sql) => p.query(sql).then((r) => r.rows);
  const [productos, clientes, stock_lotes, aprobaciones] = await Promise.all([
    q("select * from productos order by id_producto"),
    q("select * from clientes order by id_cliente"),
    q("select * from stock_lotes order by fecha_corte, id_lote"),
    q("select * from aprobaciones order by id_aprobacion"),
  ]);
  cache = { t: Date.now(), tablas: { productos, clientes, stock_lotes, aprobaciones } };
  return cache.tablas;
}

// Ejecuta fn(estado) con la fila de la sesión bloqueada: dos mensajes de la misma sesión nunca se pisan.
// fn devuelve { estado, respuesta }; el estado se guarda y la respuesta se devuelve.
async function conSesion(id, fn) {
  const c = await getPool().connect();
  try {
    await c.query("begin");
    await c.query("insert into sesiones (id, estado) values ($1, '{}'::jsonb) on conflict (id) do nothing", [id]);
    const r = await c.query("select estado from sesiones where id = $1 for update", [id]);
    const actual = r.rows[0].estado;
    const salida = await fn(actual && actual.conv ? actual : null);
    if (salida.estado) await c.query("update sesiones set estado = $2::jsonb, actualizado = now() where id = $1", [id, JSON.stringify(salida.estado)]);
    await c.query("commit");
    return salida.respuesta;
  } catch (e) {
    try { await c.query("rollback"); } catch (x) { /* nada */ }
    throw e;
  } finally {
    c.release();
  }
}

async function leerSesion(id) {
  const r = await getPool().query("select estado from sesiones where id = $1", [id]);
  return r.rows[0] ? r.rows[0].estado : null;
}

async function limpiarAntiguas() {
  await getPool().query("delete from sesiones where actualizado < now() - interval '7 days'");
}

module.exports = { leerCatalogo, conSesion, leerSesion, limpiarAntiguas };
