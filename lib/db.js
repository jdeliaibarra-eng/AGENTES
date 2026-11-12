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

// ---- Clientes creados desde la demo (se guardan en la tabla "clientes", marcados con este origen)
const ORIGEN_NUEVO = "CREADO EN LA DEMO";
const MAX_CLIENTES_NUEVOS_TOTAL = 200; // tope global: la página es pública

async function leerClientesNuevos() {
  const r = await getPool().query("select * from clientes where origen = $1 order by id_cliente", [ORIGEN_NUEVO]);
  return r.rows;
}

// Inserta el cliente con el siguiente código libre (CLI-901, CLI-902…). Si dos visitantes lo piden a la vez, se reintenta.
async function insertarClienteNuevo(c) {
  const p = getPool();
  const total = await p.query("select count(*)::int as n from clientes where origen = $1", [ORIGEN_NUEVO]);
  if (total.rows[0].n >= MAX_CLIENTES_NUEVOS_TOTAL) { const e = new Error("Se alcanzó el máximo de clientes nuevos de la demostración."); e.status = 400; throw e; }
  for (let intento = 0; intento < 5; intento++) {
    const m = await p.query("select coalesce(max(substring(id_cliente from 6)::int), 0) + 1 as n from clientes where id_cliente ~ '^CLI-9[0-9]+$'");
    const n = String(m.rows[0].n).padStart(2, "0");
    const fila = Object.assign({}, c, { id_cliente: "CLI-9" + n, cuenta_crm: "CTA-9" + n, origen: ORIGEN_NUEVO });
    try {
      const r = await p.query(
        "insert into clientes (id_cliente, cuenta_crm, razon_social, nombre_comercial, canal, distrito, estado_comercial, habilitado_erp, linea_credito, plazo_dias, deuda_vigente, compras_previas, origen) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *",
        [fila.id_cliente, fila.cuenta_crm, fila.razon_social, fila.nombre_comercial, fila.canal, fila.distrito, fila.estado_comercial, fila.habilitado_erp, fila.linea_credito, fila.plazo_dias, fila.deuda_vigente, fila.compras_previas, fila.origen]);
      cache = { t: 0, tablas: null };
      return r.rows[0];
    } catch (e) { if (e.code !== "23505") throw e; } // código repetido: otro visitante ganó, se prueba con el siguiente
  }
  throw new Error("No se pudo crear el cliente. Intente de nuevo.");
}

// Cuando Datos maestros aprueba el alta de un cliente creado en la demo, la base lo deja habilitado para todos los visitantes.
// Solo toca clientes con origen "CREADO EN LA DEMO": los del caso conservan siempre su estado original.
async function habilitarClienteNuevo(id, lineaCredito) {
  const r = await getPool().query(
    "update clientes set habilitado_erp = 'SI', linea_credito = $2, plazo_dias = case when plazo_dias in ('', '0') then '30' else plazo_dias end, estado_comercial = 'Cliente activo' where id_cliente = $1 and origen = $3 and habilitado_erp <> 'SI'",
    [id, String(lineaCredito), ORIGEN_NUEVO]);
  if (r.rowCount) cache = { t: 0, tablas: null };
  return r.rowCount;
}

module.exports = { leerCatalogo, conSesion, leerSesion, limpiarAntiguas, leerClientesNuevos, insertarClienteNuevo, habilitarClienteNuevo, ORIGEN_NUEVO };
