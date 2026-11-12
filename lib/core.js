/* Agente comercial de cara al cliente · núcleo conversacional
   Capa CRM: interpreta el mensaje, arma cotizaciones versionadas, escala a personas y espera su respuesta.
   Capa ERP: es el motor de reglas (AgenteMotor): controles C0–C4, reserva y pedido. El agente NO decide por su cuenta. */
(function (raiz, fabrica) {
  if (typeof module !== "undefined" && module.exports) module.exports = fabrica;
  else raiz.ChatAgente = fabrica(raiz.AgenteMotor);
})(typeof window !== "undefined" ? window : this, function (M) {
  "use strict";

  // ------------------------------------------------------------ utilidades
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = "0" + n; return n; }
  function clonar(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function sumaDias(iso, n) {
    var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function diaSemana(iso) { return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay(); }
  function fechaValida(y, m, d) { var dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; }
  var NOM_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  function fmtF(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : ""; }
  function fmtFL(iso) { return iso ? NOM_DIA[diaSemana(iso)] + " " + fmtF(iso) : ""; }
  function soles(x) { return "S/ " + Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(x) { return String(Number(Number(x).toFixed(2))) + " %"; }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿¡?!"“”]/g, " ").replace(/\s+/g, " ").trim();
  }
  function unico(a) { var o = [], v = {}; a.forEach(function (x) { if (!v[x]) { v[x] = 1; o.push(x); } }); return o; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------------------------------------------- números escritos con palabras
  var UNI = { cero: 0, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
    veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29 };
  var DEC = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
  var CEN = { cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
    quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
    novecientos: 900, novecientas: 900 };
  function palabrasANumeros(t) {
    t = t.replace(/por ciento/g, "porciento");
    var tk = t.split(" "), out = [], i = 0;
    while (i < tk.length) {
      var w = tk[i], sig = tk[i + 1];
      var esNum = (w in UNI) || (w in DEC) || (w in CEN) || w === "mil" ||
        ((w === "un" || w === "uno" || w === "una") && /^(caja|cajas|mil|cien|ciento)$/.test(sig || ""));
      if (!esNum) { out.push(w); i++; continue; }
      var acc = 0, tot = 0, j = i, vio = false;
      while (j < tk.length) {
        var x = tk[j];
        if (x in UNI) { acc += UNI[x]; vio = true; j++; }
        else if (x in DEC) { acc += DEC[x]; vio = true; j++; if (tk[j] === "y" && (tk[j + 1] in UNI || tk[j + 1] === "un" || tk[j + 1] === "uno" || tk[j + 1] === "una")) { var u = tk[j + 1]; acc += (u in UNI) ? UNI[u] : 1; j += 2; } }
        else if (x in CEN) { acc += CEN[x]; vio = true; j++; }
        else if (x === "mil") { tot += (acc || 1) * 1000; acc = 0; vio = true; j++; }
        else if ((x === "un" || x === "uno" || x === "una") && (j === i)) { acc += 1; vio = true; j++; }
        else break;
      }
      out.push(String(tot + acc));
      i = j;
    }
    return out.join(" ");
  }

  // --------------------------------------------------------------- fechas
  var MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  var DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  function extraerFecha(t, hoy) {
    var m, iso = null, asap = false, anio = +hoy.slice(0, 4);
    function quitar(re) { t = t.replace(re, " "); }
    var re;
    if ((m = (re = /\b(\d{4})-(\d{2})-(\d{2})\b/).exec(t))) { if (fechaValida(+m[1], +m[2], +m[3])) iso = m[0]; quitar(re); }
    else if ((m = (re = /\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de|del)\s+(\d{4}))?\b/).exec(t)) && MESES[m[2]]) {
      var y = m[3] ? +m[3] : anio, mm = MESES[m[2]], dd = +m[1];
      if (fechaValida(y, mm, dd)) { iso = y + "-" + pad(mm) + "-" + pad(dd); if (!m[3] && iso < hoy) iso = (y + 1) + "-" + pad(mm) + "-" + pad(dd); }
      quitar(re);
    }
    else if ((m = (re = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/).exec(t))) {
      var y2 = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : anio;
      if (fechaValida(y2, +m[2], +m[1])) { iso = y2 + "-" + pad(m[2]) + "-" + pad(m[1]); if (!m[3] && iso < hoy) iso = (y2 + 1) + "-" + pad(m[2]) + "-" + pad(m[1]); }
      quitar(re);
    }
    else if (/\bpasado manana\b/.test(t)) { iso = sumaDias(hoy, 2); quitar(/\bpasado manana\b/); }
    else if (/\bmanana\b/.test(t)) { iso = sumaDias(hoy, 1); quitar(/\bmanana\b/); }
    else if (/\bhoy\b/.test(t)) { iso = hoy; quitar(/\bhoy\b/); }
    else if ((m = (re = /\ben\s+(\d+)\s+(dias?|semanas?)\b/).exec(t))) { iso = sumaDias(hoy, +m[1] * (/sem/.test(m[2]) ? 7 : 1)); quitar(re); }
    else if ((m = (re = /\b(?:el\s+|este\s+|proximo\s+|el proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+proximo)?\b/).exec(t))) {
      var objetivo = DIAS[m[1]], delta = (objetivo - diaSemana(hoy) + 7) % 7; if (delta === 0) delta = 7;
      iso = sumaDias(hoy, delta); quitar(re);
    }
    else if ((m = (re = /\b(?:la )?proxima semana\b|\bsemana (?:que viene|proxima)\b/).exec(t))) { iso = sumaDias(hoy, 7); quitar(re); }
    else if ((m = (re = /\bpara el (\d{1,2})\b(?!\s*(?:de|%|porciento))/).exec(t))) {
      var dd2 = +m[1], mes = +hoy.slice(5, 7), yy = anio;
      if (fechaValida(yy, mes, dd2) && yy + "-" + pad(mes) + "-" + pad(dd2) > hoy) iso = yy + "-" + pad(mes) + "-" + pad(dd2);
      else { mes += 1; if (mes > 12) { mes = 1; yy += 1; } if (fechaValida(yy, mes, dd2)) iso = yy + "-" + pad(mes) + "-" + pad(dd2); }
      quitar(re);
    }
    if (/\b(lo antes posible|cuanto antes|urgente|a la brevedad|lo mas pronto|lo mas rapido)\b/.test(t)) { asap = true; quitar(/\b(lo antes posible|cuanto antes|urgente|a la brevedad|lo mas pronto|lo mas rapido)\b/); }
    return { iso: iso, asap: asap, resto: t };
  }

  // ------------------------------------------------------------- descuento
  function extraerDescuento(t) {
    var val = null, re, m;
    var pats = [/(\d+(?:[.,]\d+)?)\s*(?:%|porciento)/, /descuento\s*(?:de|del|al|de un|de unos|del orden de)?\s*(\d+(?:[.,]\d+)?)/,
                /(\d+(?:[.,]\d+)?)\s*(?:de|en)\s*descuento/, /(?:rebaja|dscto|dcto)\s*(?:de|del)?\s*(\d+(?:[.,]\d+)?)/];
    for (var i = 0; i < pats.length && val === null; i++) {
      re = pats[i]; m = re.exec(t);
      if (m) { val = parseFloat(m[1].replace(",", ".")); t = t.replace(re, " "); }
    }
    var menciona = /descuento|rebaja|dscto|dcto|mejor precio|mas barato|precio especial|bonificacion/.test(t) || val !== null;
    return { valor: val, menciona: menciona, resto: t };
  }

  // -------------------------------------------------------------- fábrica
  return {
    crear: function (opts) {
      var D = opts.D, cfg = D.config, emitExterno = opts.emit || function () {}, esperar = opts.esperar || function () { return Promise.resolve(); };
      var hoyFn = opts.hoy || M.hoyIso;
      var EJ = cfg.tramos_descuento.ejecutivo_max_pct, JE = cfg.tramos_descuento.jefatura_max_pct;
      var datos, S, indice;
      // Todo mensaje queda numerado en el estado: así el chat se puede reconstruir tras recargar la página o consultar desde otra pestaña.
      function emit(ev, d) {
        if (S && ev !== "escribiendo") {
          S.rev += 1;
          if (ev === "msg") { S.seq += 1; d.seq = S.seq; d.ts = Date.now(); S.msgs.push(d); if (S.msgs.length > 300) S.msgs.shift(); }
        }
        emitExterno(ev, d);
      }
      function construirDatos() {
        var tablas = clonar(D.tablas);
        Object.keys(S.altas || {}).forEach(function (id) {
          var fila = tablas.clientes.filter(function (x) { return x.id_cliente === id; })[0];
          if (fila) Object.keys(S.altas[id]).forEach(function (k) { fila[k] = S.altas[id][k]; });
        });
        return M.cargarDatos(tablas);
      }

      // ----------------------------------------------------- catálogo e índice
      var STOP = { leche: 1, gloria: 1, de: 1, la: 1, el: 1, caja: 1, cajas: 1, x: 1, sin: 1, sabor: 1, con: 1, l: 1, envases: 1, latas: 1, botellas: 1, g: 1, a: 1, en: 1, para: 1 };
      var SINON = { yogur: "yogurt", yogurth: "yogurt", yoghurt: "yogurt", deslactosada: "lactosa", deslactosado: "lactosa", descremado: "descremada",
        economico: "economica", pasteurizado: "pasteurizada", evaporadas: "evaporada", entero: "entera", fresco: "fresca", ligero: "ligera" };
      function tokens(s) {
        return norm(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean).map(function (w) { return SINON[w] || w; });
      }
      function construirIndice() {
        indice = D.tablas.productos.map(function (r) {
          var dist = unico(tokens(r.nombre).filter(function (w) { return !STOP[w] && !/^\d+$/.test(w); }));
          return { id: r.id_producto, sku: norm(r.sku), nombre: r.nombre, dist: dist, presentacion: r.presentacion, precio: Number(r.precio_base_caja),
                   cotizable: r.costo_caja !== "" && r.margen_minimo_pct !== "" };
        });
      }
      function nombreProd(id) { var p = datos.productos[id]; return p ? p.nombre : id; }
      function cliente() { return datos.clientes[S.conv.cliente] || null; }

      // ---------------------------------------------------------- intérprete
      function hallarProducto(seg) {
        var tk = tokens(seg), set = {}; tk.forEach(function (w) { set[w] = 1; });
        var porSku = indice.filter(function (p) { return p.sku && seg.replace(/\s/g, "").indexOf(p.sku.replace(/\s/g, "")) >= 0; });
        if (porSku.length === 1) return { id: porSku[0].id };
        var cand = [];
        indice.forEach(function (p) {
          var n = p.dist.filter(function (w) { return set[w]; }).length;
          if (n > 0) cand.push({ id: p.id, n: n, f: n / p.dist.length });
        });
        if (!cand.length) { // palabra genérica ("leche", "yogurt") sin otro dato: se ofrecen las presentaciones de esa familia
          var fam = set.leche ? "leche" : set.yogurt ? "yogurt" : null;
          if (!fam) return null;
          var todas = indice.filter(function (p) { return tokens(p.nombre).indexOf(fam) >= 0; });
          var cotiz = todas.filter(function (p) { return p.cotizable; });
          var ops = (cotiz.length >= 2 ? cotiz : todas).map(function (p) { return p.id; });
          return ops.length >= 2 ? { opciones: ops } : ops.length === 1 ? { id: ops[0] } : null;
        }
        cand.sort(function (a, b) { return b.f - a.f || b.n - a.n; });
        var mejores = cand.filter(function (c) { return c.f === cand[0].f && c.n === cand[0].n; });
        if (mejores.length === 1) return { id: mejores[0].id };
        return { opciones: mejores.map(function (c) { return c.id; }) };
      }
      function interpretarReglas(texto) {
        var hoy = hoyFn(), t = palabrasANumeros(norm(texto));
        var p = { texto: texto, norm: t, lineas: [], desc: null, descMenciona: false, entrega: null, asap: false, unidades: false, cantidadSuelta: null };
        t = t.replace(/\b\d+\s*(?:g|gr|ml|lt|litros?|kg)\b/g, " ");
        indice.forEach(function (pr) { if (pr.sku && t.indexOf(pr.sku) >= 0) t = t.split(pr.sku).join(" " + pr.dist.join(" ") + " "); });
        var d = extraerDescuento(t); p.desc = d.valor; p.descMenciona = d.menciona; t = d.resto;
        var f = extraerFecha(t, hoy); p.entrega = f.iso; p.asap = f.asap; t = f.resto;
        if (/\b(unidades|unidad|envases|latas|botellas|litros)\b/.test(t)) p.unidades = true;
        var segs = t.split(/\s*(?:,|;|\+|\by\b|\be\b|\bademas\b|\btambien\b)\s*/), ult = null;
        segs.forEach(function (seg) {
          if (!seg.trim()) return;
          var prod = hallarProducto(seg), nums = (seg.match(/\b\d+\b/g) || []).map(Number).filter(function (n) { return n > 0; });
          var q = nums.length ? nums[0] : null;
          if (prod && prod.id && prod.id !== undefined || (prod && prod.opciones)) {
            var it = { id: prod.id || null, opciones: prod.opciones || null, cajas: q };
            p.lineas.push(it); ult = it;
          } else if (q !== null) {
            if (ult && ult.cajas === null) { ult.cajas = q; ult = null; } else p.cantidadSuelta = q;
          }
        });
        // intención
        var neg = /\b(no acepto|no gracias|cancel\w*|rechazo|no quiero|olvidalo|dejalo|no me interesa)\b/.test(t) || /^no\b/.test(t);
        var si = /\b(acepto|aceptamos|confirmo|confirmamos|conforme|de acuerdo|procede|proceda|adelante|dale|listo|ok|okey|okay|vale|perfecto|cerramos|apruebo|si|claro|esta bien|me parece bien|hagamoslo)\b/.test(t);
        p.intent = null;
        if (neg) p.intent = "niega"; else if (si) p.intent = "acepta";
        if (/\b(como va|estado|ya (te )?respond\w*|alguna respuesta|novedades|ya aprobaron|ya hay respuesta|sigue (pendiente|en)|cuanto falta|que paso)\b/.test(t)) p.intent = "estado";
        if (/\b(catalogo|que productos|que tienen|que venden|lista de precios|precios|productos disponibles|que manejan|que ofrecen|cuales son sus productos)\b/.test(t) || /\b(que|cuales|cuantos)\b.*\b(tipos?|clases?|variedades|presentaciones|marcas|sabores|leches|yogures?|yogurt|productos)\b.*\b(hay|tienen|tiene|manejan|venden|ofrecen|existen)\b/.test(t) || /\b(que|cuales)\b.*\b(hay|tienen)\b/.test(t) && /\b(leche|leches|yogurt|yogures?|productos)\b/.test(t)) p.intent = "catalogo";
        if (/\b(ayuda|que puedes|que haces|como funciona|opciones)\b/.test(t)) p.intent = "ayuda";
        if (/\b(quien eres|quien es usted|que eres|como te llamas|cual es tu nombre|eres (un )?(robot|bot|humano|persona|ia)|con quien hablo|tu quien eres|de tu vida)\b/.test(t) && !p.lineas.length) p.intent = "identidad";
        if (/\b(quien soy|sabes quien soy|como me llamo|cual es mi nombre|con que (cliente|cuenta) (estoy|ingrese|entre)|a nombre de quien|que cuenta soy|mis datos|datos de mi (cuenta|empresa))\b/.test(t) && !p.lineas.length) p.intent = "quien_soy";
        if (/\b(nuevo pedido|otro pedido|empezar de nuevo|empezar otra vez|desde cero)\b/.test(t)) p.intent = "nuevo";
        if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|como estas|como esta usted|como te va|que tal|hey|ola)\b/.test(t) && !p.lineas.length && !p.intent) p.intent = "saludo";
        if (/\b(gracias|muchas gracias)\b/.test(t) && !p.lineas.length && p.intent !== "estado" && p.intent !== "niega") p.intent = "gracias";
        p.quitar = /\b(quita|quitar|elimina|eliminar|saca|sacar|borra|borrar|retira|retirar)\b/.test(t);
        p.agregar = /\b(agrega|agregar|anade|anadir|suma|sumar|ademas|tambien|incluye|incluir|mas)\b/.test(t);
        return p;
      }
      var INTENTS = ["acepta", "niega", "estado", "catalogo", "ayuda", "nuevo", "saludo", "gracias", "identidad", "quien_soy", "otro"];
      function sanear(p) { // valida lo que devuelva un intérprete externo (p. ej., un LLM): solo productos del catálogo, cajas enteras e intenciones conocidas
        var ok = { texto: p.texto || "", lineas: [], desc: null, descMenciona: !!p.descMenciona, entrega: null, asap: !!p.asap, unidades: !!p.unidades, cantidadSuelta: null,
                   intent: INTENTS.indexOf(p.intent) >= 0 ? p.intent : null, quitar: !!p.quitar, agregar: !!p.agregar, norm: norm(p.texto), noDisponible: limpiarNombre(p.noDisponible) };
        (p.lineas || []).forEach(function (l) {
          if (!l) return;
          var cajas = Number.isInteger(l.cajas) && l.cajas > 0 && l.cajas <= (cfg.cantidad_max_cajas_por_linea || 100000) ? l.cajas : null;
          if (l.id && datos.productos[l.id]) { ok.lineas.push({ id: l.id, opciones: null, cajas: cajas }); return; }
          var ops = (l.opciones || []).filter(function (id) { return datos.productos[id]; });
          if (ops.length >= 2) ok.lineas.push({ id: null, opciones: ops, cajas: cajas });
        });
        if (typeof p.desc === "number" && p.desc >= 0 && p.desc <= 100) { ok.desc = p.desc; ok.descMenciona = true; }
        if (/^\d{4}-\d{2}-\d{2}$/.test(p.entrega || "") && p.entrega >= hoyFn()) ok.entrega = p.entrega;
        if (Number.isInteger(p.cantidadSuelta) && p.cantidadSuelta > 0) ok.cantidadSuelta = p.cantidadSuelta;
        return ok;
      }
      function limpiarNombre(x) { // nombre de un producto que el cliente pidió y no vendemos (texto libre del intérprete, solo letras)
        if (typeof x !== "string") return "";
        var v = x.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ \-]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
        return v.length >= 3 ? v : "";
      }
      var PALABRAS_NO_PRODUCTO = { producto: 1, productos: 1, pedido: 1, cotizacion: 1, descuento: 1, catalogo: 1, precio: 1, precios: 1, caja: 1, cajas: 1, algo: 1, mas: 1, informacion: 1, ayuda: 1, stock: 1, entrega: 1, credito: 1, oferta: 1, ofertas: 1, promocion: 1, promociones: 1, lista: 1, otro: 1, otra: 1, otros: 1, otras: 1, todo: 1, nada: 1, favor: 1, saber: 1, ver: 1, que: 1, cuanto: 1, cual: 1, cuales: 1, como: 1, para: 1, por: 1, con: 1, sin: 1, unidades: 1, unidad: 1, envases: 1, litros: 1 };
      function adivinarNoDisponible(texto) { // respaldo por reglas: "quiero galletas", "tienen arroz?"; solo si la palabra no es del catálogo
        var t = norm(texto), conocido = { leche: 1, lecheria: 1, yogurt: 1, yogur: 1, yoghurt: 1, lacteo: 1, lacteos: 1, gloria: 1 };
        indice.forEach(function (pr) { tokens(pr.nombre).forEach(function (w) { conocido[w] = 1; }); (pr.dist || []).forEach(function (w) { conocido[w] = 1; }); });
        var m = t.match(/\b(?:quiero|quisiera|necesito|busco|dame|deme|me das|me vendes|me venden|tienen|tienes|tiene|venden|vendes|manejan|hay|trabajan con|ofrecen)\s+(?:(?:unas?|unos?|las?|los?|el|la|de|del|mas|algo de|algun|alguna)\s+)*([a-z\u00f1]{3,}(?:\s[a-z\u00f1]{3,})?)/);
        if (!m) return "";
        var w = m[1].split(" ")[0];
        if (PALABRAS_NO_PRODUCTO[w] || conocido[w] || /^\d+$/.test(w)) return "";
        return limpiarNombre(m[1].split(" ").filter(function (x) { return !PALABRAS_NO_PRODUCTO[x]; }).join(" "));
      }
      function utilExterno(p) { return p.lineas.length || p.noDisponible || p.entrega || p.asap || p.desc !== null || p.descMenciona || p.intent || p.cantidadSuelta !== null || p.unidades; }
      function contextoInterprete(c) { // resumen que se le entrega al intérprete externo para que entienda respuestas cortas ("el entera", "mejor 80")
        return {
          cliente: c.cliente, hoy: hoyFn(),
          borrador: c.borrador.lineas.map(function (l) { return { id: l.id_producto, cajas: l.cajas }; }),
          pregunta: c.preguntando ? { tipo: c.preguntando.tipo, opciones: c.preguntando.opciones || null, id: c.preguntando.id || null, cajas: c.preguntando.cajas || null } : null,
          cotizaciones: c.cots.map(function (q) { return { etiqueta: q.etiqueta, estado: q.estado, desc: q.desc }; }),
          catalogo: Object.keys(datos.productos).map(function (id) { var pr = datos.productos[id]; return { id: id, sku: pr.sku, nombre: pr.nombre, presentacion: pr.presentacion }; })
        };
      }

      // ----------------------------------------------------------- estado
      function nuevaConversacion(idCliente) {
        return { cliente: idCliente, cotId: null, ver: 0, cots: [], borrador: { lineas: [], entrega: null }, descDeseado: 0, pregunta: null, preguntando: null,
                 cerrado: false, pedido: null, avisoAlta: false };
      }
      function reiniciarTodo(idCliente, silencioso) {
        S = { erp: M.nuevoEstado(), tareas: [], traza: [], bit: [], cotSeq: 0, solSeq: 0, tarSeq: 0, ultimoERP: null, conv: nuevaConversacion(idCliente || "CLI-001"),
              cola: Promise.resolve(), altas: {}, msgs: [], seq: 0, rev: 0 };
        datos = construirDatos();
        construirIndice();
        if (!silencioso) emit("todo", null);
      }
      function restaurar(estado) {
        S = clonar(estado); S.cola = Promise.resolve();
        S.altas = S.altas || {}; S.msgs = S.msgs || []; S.seq = S.seq || 0; S.rev = S.rev || 0;
        datos = construirDatos();
        construirIndice();
      }
      function C() { return S.conv; }

      // --------------------------------------------------------- bitácora / traza
      function hora() { return Date.now(); }
      function hace(ts) { var m = Math.round((Date.now() - ts) / 60000); return m < 1 ? "hace un momento" : "hace " + m + " min"; }
      function traza(actor, texto, tipo, detalle) { var t = { ts: hora(), actor: actor, texto: texto, tipo: tipo || "info", detalle: detalle || null }; S.traza.push(t); if (S.traza.length > 300) S.traza.shift(); emit("traza", t); }
      function bitacora(res, entrada) { try { S.bit.push(M.filaBitacora(res, entrada)); if (S.bit.length > 300) S.bit.shift(); } catch (e) { /* la bitácora no debe frenar el flujo */ } }
      function registrarERP(res, etiqueta) {
        S.ultimoERP = { etiqueta: etiqueta, modo: res.modo, respuesta: res.respuesta || null, causa: res.causa || null, mensaje: res.mensaje || null, controles: res.controles || [], responsable: res.responsable || null };
        emit("erp", S.ultimoERP);
      }

      // ----------------------------------------------------------- mensajes
      function decir(bloques, chips) { emit("msg", { rol: "agente", bloques: bloques, chips: chips || [] }); }
      function P(t) { return { k: "p", t: t }; }
      async function hablar(bloques, chips, ms) { emit("escribiendo", true); await esperar(ms === undefined ? 650 : ms); emit("escribiendo", false); decir(bloques, chips); }

      // -------------------------------------------------- cotizaciones (CRM)
      function entregaEfectiva() { return C().borrador.entrega || sumaDias(hoyFn(), cfg.dias_entrega_defecto); }
      function entradaDe(q, aceptada) {
        var hoy = hoyFn();
        return {
          cliente: C().cliente,
          cotizacion: { id: C().cotId, version: q.ver, fecha_emision: q.emision, vigencia_hasta: q.vigencia || undefined, aceptada: !!aceptada, fecha_aceptacion: aceptada ? hoy : undefined },
          lineas: clonar(q.lineas), descuento_pct: q.desc, aprobaciones: { descuento: q.apDesc || null, credito: q.apCred || null },
          solicitud: { id: q.solId || "SOL-PREV", fecha: hoy, entrega_solicitada: q.entrega, modalidad: "UNICA" }
        };
      }
      function buscarQ(et) { return C().cots.filter(function (q) { return q.etiqueta === et; })[0] || null; }
      function ofrecidas() { return C().cots.filter(function (q) { return q.estado === "OFRECIDA"; }); }
      function pendientes() { return C().cots.filter(function (q) { return q.estado === "PENDIENTE_JEFATURA" || q.estado === "PENDIENTE_FINANZAS"; }); }
      function mismasLineas(a, b) {
        if (a.length !== b.length) return false;
        return a.every(function (x) { return b.some(function (y) { return y.id_producto === x.id_producto && y.cajas === x.cajas; }); });
      }

      // Evalúa lo que el negocio permite antes de crear la versión (cálculo del motor, nada inventado).
      function sondear(lineas) {
        var q0 = { ver: C().ver + 1, emision: hoyFn(), lineas: lineas, desc: 0, entrega: entregaEfectiva() };
        if (!C().cotId) { S.cotSeq += 1; C().cotId = "COT-" + pad(S.cotSeq, 4); }
        var ent = entradaDe(q0, false), r = M.cotizar(ent, datos, cfg, S.erp, hoyFn());
        bitacora(r, ent);
        return r;
      }
      function nuevaVersion(desc, lineas, tipoEstado) {
        C().ver += 1;
        var q = { etiqueta: null, ver: C().ver, desc: desc, lineas: clonar(lineas), emision: hoyFn(), entrega: entregaEfectiva(), estado: tipoEstado, apDesc: null, apCred: null, solId: null,
                  cot: null, prev: null, planVisto: false, tareaId: null, vigencia: null };
        var ent = entradaDe(q, false), r = M.cotizar(ent, datos, cfg, S.erp, hoyFn());
        bitacora(r, ent);
        q.cot = r.cotizacion; q.etiqueta = r.cotizacion ? r.cotizacion.etiqueta : C().cotId + "-V" + pad(q.ver);
        q.vigencia = r.cotizacion ? r.cotizacion.vigencia_hasta : null;
        C().cots.push(q);
        traza("Agente (CRM)", "Cotiza " + q.etiqueta + " con " + pct(desc) + " de descuento", "info", r.cotizacion ? r.cotizacion.autorizacion.detalle : "");
        return q;
      }
      function bloqueCot(q) {
        var c = q.cot, aut = c.autorizacion;
        var origen = aut.estado === "APROBADA_JEFATURA" ? "Aprobado por la Jefatura Comercial" : (q.desc > 0 ? "Autorizado por el agente comercial" : "Sin descuento");
        return { k: "cot", etiqueta: q.etiqueta, desc: q.desc, origen: origen, vigencia: c.vigencia_hasta, entrega: q.entrega,
                 lineas: c.lineas.map(function (l) { return { nombre: l.nombre, cajas: l.cajas, lista: l.precio_lista, neto: l.precio_neto, subtotal: l.subtotal }; }),
                 totales: { lista: c.totales.lista, descuento: c.totales.descuento, subtotal: c.totales.subtotal, igv: c.totales.igv, total: c.totales.total } };
      }

      // ¿Cómo está el ERP respecto de esta cotización? (simulacro, sin efectos)
      function consultarERP(q) {
        var ent = entradaDe(q, true), r = M.previsualizar(ent, datos, cfg, S.erp, hoyFn());
        bitacora(r, ent); registrarERP(r, q.etiqueta);
        traza("ERP", "Verifica " + q.etiqueta + " (simulacro, sin reservar): " + (r.respuesta || ""), r.respuesta === "ACEPTADA" ? "ok" : "alerta", (r.controles || []).map(function (c) { return c.id + "=" + c.resultado; }).join(" · "));
        q.prev = { respuesta: r.respuesta, causa: r.causa, res: r };
        return r;
      }

      function crearTarea(t) {
        S.tarSeq += 1; t.id = "TAR-" + pad(S.tarSeq, 3); t.estado = "PENDIENTE"; t.creada = hora(); S.tareas.push(t);
        traza("Agente (CRM)", "Escala a " + t.rol + ": " + t.titulo, "escala", t.detalle || "");
        emit("tareas", null); return t;
      }
      function cerrarTarea(t, estado, texto) { t.estado = estado; t.resuelta = hora(); t.resultado = texto || ""; emit("tareas", null); }
      function tareaDe(q, tipo) { return S.tareas.filter(function (t) { return t.etiqueta === q.etiqueta && t.tipo === tipo && t.estado === "PENDIENTE"; })[0] || null; }

      // Presenta una cotización lista para aceptar, con lo que dice el ERP sobre stock y crédito.
      async function ofrecer(q, intro, extra) {
        var r = consultarERP(q), bl = [], chips = [];
        if (intro) bl.push(P(intro));
        bl.push(bloqueCot(q));
        var aceptar = { t: "Confirmo " + q.etiqueta, a: { k: "aceptar", q: q.etiqueta } };
        var resp = r.respuesta, causa = r.causa;
        if (resp === "ACEPTADA") {
          bl.push(P("Hay stock liberado para entregarle el " + fmtFL(q.entrega) + ". ¿Desea que registre el pedido?"));
          chips.push(aceptar);
        } else if (resp === "APROBACION_REQUERIDA" && /CREDITO/.test(causa)) {
          var cr = r.credito || {};
          bl.push(P("Un aviso: el total (" + soles(q.cot.totales.total) + ") supera su crédito disponible (" + soles(cr.disponible || 0) + "). Si confirma, lo envío a Finanzas para su validación; hasta que respondan no puedo registrar el pedido."));
          chips.push({ t: "Confirmo y envío a Finanzas", a: { k: "aceptar", q: q.etiqueta } });
          chips.push({ t: "Ajustar cantidades", a: { k: "ayuda_ajuste" } });
        } else if (resp === "PROMESA_ALTERNATIVA") {
          q.planVisto = true;
          bl.push(P("No tengo stock liberado de todo para el " + fmtFL(q.entrega) + ", pero puedo respaldar esta entrega en dos momentos:"));
          bl.push({ k: "entregas", items: r.promesa.entregas.map(function (e) { return { fecha: fmtFL(e.fecha), cajas: e.cajas, detalle: e.detalle.map(function (d) { return d.nombre + " · " + d.cajas + " cajas"; }) }; }) });
          bl.push(P("No es un compromiso hasta que usted lo acepte. ¿Le sirve?"));
          chips.push({ t: "Acepto la entrega en dos momentos", a: { k: "aceptar", q: q.etiqueta } });
          chips.push({ t: "No, gracias", a: { k: "rechazar_plan", q: q.etiqueta } });
        } else if (resp === "CASO_ATENCION" && causa === "FALTANTE_SIN_FECHA_SUSTENTADA") {
          var disp = r.promesa ? r.promesa.disponible_ahora : 0;
          bl.push(P("No puedo prometerle todo el volumen: hoy hay " + disp + " de " + r.promesa.total_solicitado + " cajas disponibles y no tengo una reposición sustentada para el resto. No quiero darle una fecha que no pueda respaldar."));
          if (disp > 0) chips.push({ t: "Pedir solo lo disponible (" + disp + " cajas)", a: { k: "solo_disponible", q: q.etiqueta } });
          chips.push({ t: "Consultar con Planeamiento", a: { k: "consultar_plan", q: q.etiqueta } });
        } else if (resp === "CASO_ATENCION" && causa === "CLIENTE_NO_HABILITADO") {
          bl.push(P("Su cuenta todavía no está habilitada para comprar en nuestro sistema, por eso no puedo registrar un pedido. Esta cotización es solo referencial."));
          if (!C().avisoAlta) {
            C().avisoAlta = true;
            var cl = cliente();
            crearTarea({ rol: "Datos maestros (MDG) / Finanzas", tipo: "ALTA_CLIENTE", etiqueta: q.etiqueta, cliente: C().cliente, titulo: "Habilitar a " + (cl ? cl.nombre_comercial : C().cliente) + " en el ERP",
                         detalle: "El cliente figura en el CRM pero no está habilitado en el ERP. Requiere alta y línea de crédito.", solicitado: null });
            bl.push(P("Ya abrí la solicitud de alta con Datos maestros y le aviso apenas esté lista."));
          }
          q.estado = "REFERENCIAL";
        } else {
          bl.push(P("Todavía no puedo registrar este pedido: " + (r.mensaje || "revisión pendiente") + "."));
        }
        if (resp === "ACEPTADA" || (resp === "APROBACION_REQUERIDA" && /CREDITO/.test(causa))) {
          chips.push({ t: "Pedir un descuento", a: { k: "pedir_desc" } });
        }
        if (extra && extra.bloques) bl = bl.concat(extra.bloques);
        if (extra && extra.chips) chips = chips.concat(extra.chips);
        await hablar(bl, chips);
      }

      // ------------------------------------------------ flujo: pedido nuevo o modificado
      async function procesarPedido(p) {
        var c = C();
        if (c.cerrado) { var cid = c.cliente; S.conv = nuevaConversacion(cid); c = C(); }
        if (p.unidades) {
          await hablar([P("Nosotros vendemos por caja (por ejemplo, la leche UHT viene en cajas de 12 envases). ¿Cuántas cajas necesita?")], [], 450);
        }
        // 1) productos ambiguos
        for (var i = 0; i < p.lineas.length; i++) {
          var l = p.lineas[i];
          if (l.opciones) {
            c.preguntando = { tipo: "producto", opciones: l.opciones, cajas: l.cajas };
            await hablar([P("Tenemos varias presentaciones que coinciden. ¿Cuál de ellas desea" + (l.cajas ? " (" + l.cajas + " cajas)" : "") + "?")],
              l.opciones.map(function (id) { return { t: nombreProd(id), a: { k: "elegir", id: id } }; }));
            return;
          }
        }
        // 2) productos sin cantidad
        var sinCant = p.lineas.filter(function (l) { return l.cajas === null; });
        // quitar
        if (p.quitar && p.lineas.length) {
          p.lineas.forEach(function (l) { c.borrador.lineas = c.borrador.lineas.filter(function (x) { return x.id_producto !== l.id; }); });
          if (!c.borrador.lineas.length) { await hablar([P("De acuerdo, retiré ese producto. Su pedido quedó vacío: dígame qué necesita y le cotizo.")]); return; }
        } else {
          for (var k = 0; k < p.lineas.length; k++) {
            var li = p.lineas[k];
            if (li.cajas === null) continue;
            var ex = c.borrador.lineas.filter(function (x) { return x.id_producto === li.id; })[0];
            if (ex) ex.cajas = (p.agregar && !/\b(cambia|cambiar|mejor|ahora|en vez|solo|modifica)\b/.test(p.norm)) ? ex.cajas + li.cajas : li.cajas;
            else c.borrador.lineas.push({ id_producto: li.id, cajas: li.cajas });
          }
        }
        if (sinCant.length) {
          c.preguntando = { tipo: "cantidad", id: sinCant[0].id };
          await hablar([P("¿Cuántas cajas de " + nombreProd(sinCant[0].id) + " necesita?")], [10, 50, 100, 200].map(function (n) { return { t: n + " cajas", a: { k: "cantidad", id: sinCant[0].id, n: n } }; }));
          return;
        }
        c.preguntando = null;
        if (p.entrega) c.borrador.entrega = p.entrega; else if (p.asap) c.borrador.entrega = sumaDias(hoyFn(), cfg.dias_entrega_defecto);
        if (typeof p.desc === "number") c.descDeseado = p.desc;
        await cotizarBorrador();
      }

      async function cotizarBorrador(notaPrevia) {
        var c = C(), lineas = c.borrador.lineas, hoy = hoyFn();
        if (!lineas.length) { await hablar([P("Aún no tengo productos en su pedido. ¿Qué necesita?")]); return; }
        // anula pendientes anteriores: cambió el pedido o el descuento
        var anuladas = [];
        c.cots.forEach(function (q) {
          if (q.estado === "PENDIENTE_JEFATURA") {
            q.estado = "ANULADA"; var t = tareaDe(q, "DESCUENTO"); if (t) cerrarTarea(t, "ANULADA", "El cliente cambió su solicitud.");
            anuladas.push(q.etiqueta);
          }
        });
        // sondeo: qué productos se pueden cotizar y cuánto descuento permiten los márgenes
        var s = sondear(lineas), bloq = (s.cotizacion && s.cotizacion.bloqueos) || [], nombres = [];
        if (!s.cotizacion) { await hablar([P("No pude armar la cotización: " + (s.errores || []).map(function (e) { return e.mensaje; }).join(" "))]); return; }
        var inval = [];
        s.cotizacion.lineas.forEach(function (l) { if (l.max_descuento_pct === null || l.costo_total === null) inval.push(l); });
        bloq.forEach(function (b) { if (b.causa === "SIN_COSTO_O_MARGEN" || b.causa === "PRODUCTO_NO_ENCONTRADO") nombres.push(b.causa); });
        if (inval.length || nombres.length) {
          var ids = inval.map(function (l) { return l.id_producto; });
          // productos sin costeo no salen en cotizaciones.lineas con max_descuento (null): se retiran del borrador
          var fuera = c.borrador.lineas.filter(function (l) { var pr = datos.productos[l.id_producto]; return !pr || pr.costo_cents === null || pr.margen_min_bp === null || ids.indexOf(l.id_producto) >= 0; });
          if (fuera.length) {
            c.borrador.lineas = c.borrador.lineas.filter(function (l) { return fuera.indexOf(l) < 0; });
            traza("Agente (CRM)", "No cotiza " + fuera.map(function (l) { return l.id_producto; }).join(", "), "alerta", "Sin costeo, o el precio no alcanza el margen mínimo: no se puede cotizar.");
            await hablar([P("Por ahora no puedo cotizarle " + fuera.map(function (l) { return nombreProd(l.id_producto); }).join(" ni ") + ": el producto está en revisión de precios. " +
              (c.borrador.lineas.length ? "Sigo con el resto de su pedido." : "¿Desea cotizar otro producto?"))], c.borrador.lineas.length ? [] : [{ t: "Ver catálogo", a: { k: "catalogo" } }], 500);
            if (!c.borrador.lineas.length) return;
            return cotizarBorrador();
          }
        }
        var permitido = Math.min.apply(null, s.cotizacion.lineas.map(function (l) { return l.max_descuento_pct; }));
        permitido = Math.floor(permitido * 10) / 10;
        var deseado = c.descDeseado || 0, notas = [], efectivo = deseado;
        if (deseado > JE) { efectivo = Math.min(EJ, permitido); notas.push("fuera"); }
        else if (efectivo > permitido) { efectivo = permitido; notas.push("margen"); }
        var base = Math.min(efectivo, EJ), previa = ofrecidas().filter(function (q) { return mismasLineas(q.lineas, lineas) && q.desc >= base && q.entrega === entregaEfectiva(); })[0];
        var intro = notaPrevia || null, bloques = [], chips = [];
        if (anuladas.length) intro = (intro ? intro + " " : "") + "Dejé sin efecto la consulta anterior a la Jefatura (" + anuladas.join(", ") + ") porque cambió su solicitud.";
        // reemplazar ofertas con otras líneas
        ofrecidas().forEach(function (q) { if (!mismasLineas(q.lineas, lineas)) q.estado = "REEMPLAZADA"; });

        var qBase = previa || null;
        if (!qBase) {
          qBase = nuevaVersion(base, lineas, "OFRECIDA");
          ofrecidas().forEach(function (q) { if (q !== qBase && mismasLineas(q.lineas, lineas)) q.estado = "REEMPLAZADA"; });
        }
        if (efectivo > EJ) {
          var qJ = nuevaVersion(efectivo, lineas, "PENDIENTE_JEFATURA");
          var ficha = qJ.cot.ficha_jefatura || {};
          var t = crearTarea({ rol: "Jefatura Comercial", tipo: "DESCUENTO", etiqueta: qJ.etiqueta, cliente: C().cliente, titulo: "Autorizar descuento de " + pct(efectivo) + " para " + qJ.etiqueta,
            detalle: ficha.resumen || "", solicitado: efectivo, ficha: ficha, total: qJ.cot.totales.total });
          qJ.tareaId = t.id;
          var txt = [];
          if (notas.indexOf("margen") >= 0) txt.push("Con esos productos el descuento máximo posible es " + pct(permitido) + ", así que solicito ese valor.");
          txt.push("Un descuento de " + pct(efectivo) + " lo decide la Jefatura Comercial; ya envié la solicitud como " + qJ.etiqueta + ". En cuanto respondan se lo informo aquí.");
          var bl = [];
          if (intro) bl.push(P(intro));
          bl.push(P(previa ? "Mientras tanto, su oferta vigente sigue siendo esta:" : (intro ? "" : "Con gusto. ") + "Esta es la cotización con lo que puedo autorizar yo (" + pct(base) + "):")); bl.push(bloqueCot(qBase));
          bl.push(P(txt.join(" ")));
          bl.push({ k: "espera", rol: "Jefatura Comercial", texto: "Solicitud de " + pct(efectivo) + " en validación (" + qJ.etiqueta + ")" });
          chips.push({ t: "Acepto " + qBase.etiqueta + " (" + pct(base) + ")", a: { k: "aceptar", q: qBase.etiqueta } });
          chips.push({ t: "Espero la respuesta", a: { k: "esperar" } });
          consultarERP(qBase);
          await hablar(bl, chips);
          return;
        }
        var extra = { bloques: [], chips: [] };
        if (notas.indexOf("fuera") >= 0) {
          extra.bloques.push(P("Sobre su pedido de " + pct(deseado) + ": la política comercial no permite pasar de " + pct(JE) + ", así que ese valor no lo puedo gestionar." +
            (permitido > EJ ? " Lo máximo que puedo solicitar es " + pct(Math.min(JE, permitido)) + ", con aprobación de la Jefatura." : "")));
          if (permitido > EJ) extra.chips.push({ t: "Solicitar " + pct(Math.min(JE, permitido)) + " a la Jefatura", a: { k: "desc", n: Math.min(JE, permitido) } });
          c.descDeseado = efectivo;
        } else if (notas.indexOf("margen") >= 0) {
          extra.bloques.push(P("Con esos productos el descuento máximo que puedo aplicar es " + pct(efectivo) + "."));
        }
        await ofrecer(qBase, previa ? (intro ? intro + " " : "") + "Esta es su oferta vigente:" : intro, extra);
      }

      // --------------------------------------------------------------- descuento
      async function pedirDescuento(n) {
        var c = C();
        if (!c.borrador.lineas.length || c.cerrado) { await hablar([P("Con gusto veo un descuento. Primero indíqueme qué productos y cuántas cajas necesita para cotizar.")]); return; }
        if (n === null) {
          await hablar([P("Puedo autorizar yo hasta " + pct(EJ) + ". Entre " + pct(EJ) + " y " + pct(JE) + " debo pedir la aprobación de la Jefatura Comercial; sobre " + pct(JE) + " no lo permite la política. ¿Qué descuento necesita?")],
            [{ t: pct(EJ), a: { k: "desc", n: EJ } }, { t: "8 %", a: { k: "desc", n: 8 } }, { t: pct(JE), a: { k: "desc", n: JE } }]);
          return;
        }
        var vigente = ofrecidas().concat(pendientes()).filter(function (q) { return mismasLineas(q.lineas, c.borrador.lineas); }).sort(function (a, b) { return b.desc - a.desc; })[0];
        if (vigente && n <= vigente.desc && vigente.estado === "OFRECIDA") {
          await hablar([P("Ya cuenta con " + pct(vigente.desc) + " en " + vigente.etiqueta + ", que es igual o mejor que lo que pide. ¿Le confirmo el pedido con esa cotización?")], [{ t: "Confirmo " + vigente.etiqueta, a: { k: "aceptar", q: vigente.etiqueta } }]);
          return;
        }
        if (vigente && vigente.estado === "PENDIENTE_JEFATURA" && Math.abs(vigente.desc - n) < 0.001) {
          await hablar([P("Esa solicitud ya está con la Jefatura (" + vigente.etiqueta + "). Le aviso apenas respondan.")]); return;
        }
        c.descDeseado = n;
        await cotizarBorrador();
      }

      // ---------------------------------------------------------------- aceptación
      function elegirCotizacion() {
        var of = ofrecidas(), pe = pendientes();
        if (of.length === 1 && !pe.length) return { q: of[0] };
        if (of.length === 1 && pe.length) return { q: of[0], duda: true };
        if (of.length > 1) return { q: of.sort(function (a, b) { return b.ver - a.ver; })[0] };
        return { q: null, pendiente: pe[0] || null };
      }
      async function aceptar(q) {
        var c = C();
        if (!q || (q.estado !== "OFRECIDA" && q.estado !== "PENDIENTE_FINANZAS")) { await hablar([P("Esa cotización ya no está disponible para confirmar. ¿Quiere que le prepare una nueva?")]); return; }
        // al aceptar, las otras solicitudes en curso quedan sin efecto
        c.cots.forEach(function (o) {
          if (o !== q && o.estado === "PENDIENTE_JEFATURA") { o.estado = "ANULADA"; var t = tareaDe(o, "DESCUENTO"); if (t) cerrarTarea(t, "ANULADA", "El cliente confirmó otra versión."); }
          else if (o !== q && o.estado === "OFRECIDA") o.estado = "REEMPLAZADA";
        });
        if (!q.solId) { S.solSeq += 1; q.solId = cfg.prefijo_solicitud + pad(S.solSeq, 4); }
        q.estado = "OFRECIDA";
        await enviarAlERP(q);
      }
      async function enviarAlERP(q) {
        var ent = entradaDe(q, true), res;
        traza("Agente (CRM)", "El cliente aceptó " + q.etiqueta + ": envía SOLICITAR_CREACION_PEDIDO (" + q.solId + ") al ERP", "info");
        res = q.planVisto ? M.confirmarPromesa(ent, datos, cfg, S.erp, hoyFn(), true) : M.solicitarPedido(ent, datos, cfg, S.erp, hoyFn());
        bitacora(res, ent); registrarERP(res, q.etiqueta);
        traza("ERP", "Responde " + res.respuesta + " · " + res.causa, res.respuesta === "ACEPTADA" ? "ok" : "alerta", res.mensaje);
        await tratarRespuesta(q, res);
      }
      async function tratarRespuesta(q, res) {
        var c = C(), r = res.respuesta;
        if (r === "ACEPTADA") {
          q.estado = "ACEPTADA"; c.cerrado = true; c.pedido = res.id_pedido;
          var entregas = res.promesa && res.promesa_confirmada ? res.promesa.entregas.map(function (e) { return { fecha: fmtFL(e.fecha), cajas: e.cajas }; }) : [{ fecha: fmtFL(q.entrega), cajas: q.cot.totales.cajas }];
          await hablar([P("Listo, su pedido quedó registrado."), { k: "pedido", id: res.id_pedido, solicitud: q.solId, cotizacion: q.etiqueta, total: q.cot.totales.total, cajas: q.cot.totales.cajas, entregas: entregas },
            P("Reservé el stock para usted. Gracias por su compra.")], [{ t: "Hacer otro pedido", a: { k: "nuevo" } }]);
          return;
        }
        if (r === "APROBACION_REQUERIDA" && /CREDITO/.test(res.causa)) {
          var cr = res.credito || {};
          if (!tareaDe(q, "CREDITO")) {
            var t = crearTarea({ rol: "Finanzas", tipo: "CREDITO", etiqueta: q.etiqueta, cliente: C().cliente, titulo: "Exceso de crédito en " + q.etiqueta,
              detalle: res.mensaje, solicitado: q.cot.totales.total, credito: cr, total: q.cot.totales.total });
            q.tareaId = t.id;
          }
          q.estado = "PENDIENTE_FINANZAS";
          await hablar([P("Su confirmación quedó registrada, pero el total (" + soles(cr.total_con_igv) + ") supera su crédito disponible (" + soles(cr.disponible) + "). Lo envié a Finanzas para su validación; hasta que decidan no puedo crear el pedido. Le avisaré aquí mismo."),
            { k: "espera", rol: "Finanzas", texto: "Crédito en validación (" + q.etiqueta + ")" }], [{ t: "Ver estado", a: { k: "estado" } }]);
          return;
        }
        if (r === "APROBACION_REQUERIDA") { // descuento sin aprobación válida
          await hablar([P("Este pedido requiere una autorización que todavía no tengo (" + res.causa.toLowerCase().replace(/_/g, " ") + "). Lo dejo en revisión y le aviso.")]); return;
        }
        if (r === "PROMESA_ALTERNATIVA") {
          q.planVisto = true;
          await hablar([P("Para el " + fmtFL(q.entrega) + " no tengo todo el stock liberado, pero puedo respaldar esta entrega en dos momentos:"),
            { k: "entregas", items: res.promesa.entregas.map(function (e) { return { fecha: fmtFL(e.fecha), cajas: e.cajas, detalle: e.detalle.map(function (d) { return d.nombre + " · " + d.cajas + " cajas"; }) }; }) },
            P("El pedido se crea solo si usted lo acepta.")],
            [{ t: "Acepto la entrega en dos momentos", a: { k: "aceptar", q: q.etiqueta } }, { t: "No, gracias", a: { k: "rechazar_plan", q: q.etiqueta } }]);
          return;
        }
        if (r === "CASO_ATENCION") {
          if (res.causa === "CLIENTE_NO_HABILITADO") {
            if (!C().avisoAlta) {
              C().avisoAlta = true;
              crearTarea({ rol: "Datos maestros (MDG) / Finanzas", tipo: "ALTA_CLIENTE", etiqueta: q.etiqueta, cliente: C().cliente, titulo: "Habilitar cliente en el ERP", detalle: res.mensaje });
            }
            await hablar([P("Su cuenta aún no está habilitada para comprar, así que no pude registrar el pedido. Ya pedí el alta a Datos maestros y le aviso cuando esté lista.")]);
          } else {
            await hablar([P("No puedo comprometer toda la entrega: " + res.mensaje)], [{ t: "Consultar con Planeamiento", a: { k: "consultar_plan", q: q.etiqueta } }]);
          }
          return;
        }
        if (res.decision_cliente === "RECHAZA") {
          q.estado = "CERRADA";
          await hablar([P("Entendido, no registro el pedido. Si lo desea, puedo cotizar solo lo que hay disponible o preparar otra alternativa.")], [{ t: "Ver catálogo", a: { k: "catalogo" } }]);
          return;
        }
        await hablar([P("No pude registrar el pedido: " + (res.mensaje || "revise los datos") + ".")]);
      }

      // --------------------------------------------------------- resolver tareas (personas)
      async function resolverTarea(id, dec) {
        var t = S.tareas.filter(function (x) { return x.id === id; })[0];
        if (!t || t.estado !== "PENDIENTE") return { ok: false, error: "La tarea ya no está pendiente." };
        var q = buscarQ(t.etiqueta);
        if (t.tipo === "DESCUENTO") {
          if (!q || q.estado !== "PENDIENTE_JEFATURA") return { ok: false, error: "La cotización ya no está en validación." };
          if (!dec.aprobar) {
            q.estado = "RECHAZADA"; cerrarTarea(t, "RECHAZADA", dec.motivo || "No aprobado por la Jefatura.");
            traza("Jefatura Comercial", "Rechaza el descuento de " + pct(q.desc) + " para " + q.etiqueta, "mal", dec.motivo || "");
            var of = ofrecidas();
            await hablar([P("La Jefatura Comercial no aprobó el descuento de " + pct(q.desc) + " para " + q.etiqueta + "." + (dec.motivo ? " Motivo: " + dec.motivo + "." : ""))].concat(
              of.length ? [P("Sigue vigente " + of[0].etiqueta + " con " + pct(of[0].desc) + ". ¿Desea confirmarla?")] : [P("¿Quiere que le prepare una cotización con otro descuento?")]),
              of.length ? [{ t: "Confirmo " + of[0].etiqueta, a: { k: "aceptar", q: of[0].etiqueta } }, { t: "Pedir otro descuento", a: { k: "pedir_desc" } }] : [{ t: "Pedir otro descuento", a: { k: "pedir_desc" } }]);
            return { ok: true };
          }
          var valor = Number(dec.valor);
          if (!isFinite(valor) || valor < 0 || valor > JE) return { ok: false, error: "El valor aprobado debe estar entre 0 y " + JE + " %." };
          var final = Math.min(valor, q.desc), reg = null;
          if (final > EJ) reg = M.registrarAprobacion(S.erp, "DESCUENTO", q.etiqueta, valor, "Jefatura Comercial", dec.motivo || "");
          q.desc = final; q.apDesc = reg ? reg.id_aprobacion : null;
          var ent = entradaDe(q, false), rr = M.cotizar(ent, datos, cfg, S.erp, hoyFn()); bitacora(rr, ent);
          if (!rr.cotizacion || rr.cotizacion.bloqueos.length) { return { ok: false, error: "El motor no valida ese valor: " + ((rr.cotizacion && rr.cotizacion.bloqueos[0] && rr.cotizacion.bloqueos[0].detalle) || "revise datos") }; }
          q.cot = rr.cotizacion; q.estado = "OFRECIDA";
          ofrecidas().forEach(function (o) { if (o !== q) o.estado = "REEMPLAZADA"; });
          cerrarTarea(t, "APROBADA", (reg ? reg.id_aprobacion + " · " : "") + "hasta " + pct(valor));
          traza("Jefatura Comercial", "Aprueba " + pct(final) + " para " + q.etiqueta + (reg ? " (" + reg.id_aprobacion + ")" : ""), "ok", dec.motivo || "");
          await ofrecer(q, final < t.solicitado ? "La Jefatura aprobó " + pct(final) + " (usted pidió " + pct(t.solicitado) + "). Esta es la cotización con ese descuento:" : "Buenas noticias: la Jefatura Comercial aprobó el descuento de " + pct(final) + ". Esta es su cotización actualizada:");
          return { ok: true };
        }
        if (t.tipo === "CREDITO") {
          if (!q) return { ok: false, error: "No encuentro la cotización." };
          if (!dec.aprobar) {
            q.estado = "RECHAZADA_CREDITO"; cerrarTarea(t, "RECHAZADA", dec.motivo || "Crédito no aprobado.");
            traza("Finanzas", "Rechaza el exceso de crédito de " + q.etiqueta, "mal", dec.motivo || "");
            var cr = t.credito || {};
            await hablar([P("Finanzas no aprobó el exceso de crédito." + (dec.motivo ? " Motivo: " + dec.motivo + "." : "") + " Su crédito disponible es " + soles(cr.disponible || 0) + ". Si reduce las cantidades hasta ese monto (incluido IGV), puedo cotizarle de nuevo.")],
              [{ t: "Ajustar cantidades", a: { k: "ayuda_ajuste" } }]);
            return { ok: true };
          }
          var monto = Number(dec.valor);
          if (!isFinite(monto) || monto < t.total) return { ok: false, error: "El monto aprobado debe cubrir el total del pedido (" + soles(t.total) + ")." };
          var reg2 = M.registrarAprobacion(S.erp, "CREDITO", q.etiqueta, monto, "Finanzas", dec.motivo || "");
          q.apCred = reg2.id_aprobacion; cerrarTarea(t, "APROBADA", reg2.id_aprobacion + " · hasta " + soles(monto));
          traza("Finanzas", "Aprueba el exceso de crédito de " + q.etiqueta + " (" + reg2.id_aprobacion + ")", "ok", dec.motivo || "");
          q.estado = "OFRECIDA";
          await hablar([P("Finanzas aprobó el crédito. Registro su pedido ahora.")], [], 350);
          await enviarAlERP(q);
          return { ok: true };
        }
        if (t.tipo === "ALTA_CLIENTE") {
          if (!dec.aprobar) { cerrarTarea(t, "RECHAZADA", dec.motivo || "No se habilita."); await hablar([P("Datos maestros no pudo habilitar su cuenta por ahora." + (dec.motivo ? " Motivo: " + dec.motivo + "." : "") + " Un ejecutivo se pondrá en contacto con usted.")]); return { ok: true }; }
          var linea = Number(dec.valor);
          if (!isFinite(linea) || linea < 0) return { ok: false, error: "Indique una línea de crédito válida (0 o más)." };
          var fila = D.tablas.clientes.filter(function (x) { return x.id_cliente === t.cliente; })[0] || {};
          S.altas[t.cliente] = { habilitado_erp: "SI", linea_credito: String(linea), deuda_vigente: fila.deuda_vigente || "0" };
          datos = construirDatos();
          cerrarTarea(t, "APROBADA", "Habilitado con línea " + soles(linea));
          traza("Datos maestros", "Habilita a " + t.cliente + " en el ERP con línea " + soles(linea), "ok", dec.motivo || "");
          var qq = buscarQ(t.etiqueta);
          if (qq && qq.estado === "REFERENCIAL") { qq.estado = "OFRECIDA"; await ofrecer(qq, "Su cuenta ya está habilitada en nuestro sistema. Revalidé su cotización:"); }
          else await hablar([P("Su cuenta ya está habilitada. Puede hacer su pedido.")]);
          return { ok: true };
        }
        if (t.tipo === "REPOSICION") {
          cerrarTarea(t, "ATENDIDA", dec.motivo || "Planeamiento no puede sustentar una fecha.");
          traza("Planeamiento", "Responde: no hay fecha de reposición sustentada", "alerta", dec.motivo || "");
          var disp = (q && q.prev && q.prev.res && q.prev.res.promesa) ? q.prev.res.promesa.disponible_ahora : 0;
          await hablar([P("Planeamiento revisó el abastecimiento y por ahora no puede respaldar una fecha para el faltante." + (disp ? " Puedo registrarle lo disponible hoy (" + disp + " cajas)." : ""))],
            disp && q ? [{ t: "Pedir solo lo disponible (" + disp + " cajas)", a: { k: "solo_disponible", q: q.etiqueta } }] : []);
          return { ok: true };
        }
        return { ok: false, error: "Tipo de tarea desconocido." };
      }

      // ------------------------------------------------------------------ otros mensajes
      async function quienSoy() {
        var cl = cliente();
        if (!cl) return hablar([P("Todavía no tengo identificado a su cliente. Elija su cuenta en «Ingresa como», arriba a la derecha.")], [], 350);
        var alta = (S.altas || {})[cl.id_cliente];
        var hab = !!cl.habilitado || !!alta;
        var lineaSoles = alta ? Number(alta.linea_credito) : cl.linea_cents / 100;
        var linea = "Usted ingresó como " + cl.nombre_comercial + " (" + cl.id_cliente + "), " + cl.razon_social + ", canal " + String(cl.canal || "").toLowerCase() + (cl.distrito ? ", distrito de " + cl.distrito : "") + ".";
        var estado = hab
          ? "Está habilitado en el ERP, con una línea de crédito de " + soles(lineaSoles) + (cl.plazo_dias ? " a " + cl.plazo_dias + " días." : ".")
          : "Todavía no está habilitado en el ERP (estado comercial: " + String(cl.estado_comercial || "").toLowerCase() + "); si pide una cotización, la dejo lista y gestiono su alta con Finanzas.";
        return hablar([P(linea), P(estado), P("¿Qué productos y cuántas cajas necesita?")], [{ t: "Ver catálogo", a: { k: "catalogo" } }], 350);
      }

      async function saludo() {
        var cl = cliente();
        await hablar([P("Hola" + (cl ? ", " + cl.nombre_comercial : "") + ". Soy la asistente virtual de Gloria. Dígame qué productos y cuántas cajas necesita, y si quiere una fecha de entrega o un descuento; le preparo la cotización."),
          P("Por ejemplo: «Quiero 100 cajas de leche UHT entera para el viernes»")], [{ t: "Ver catálogo", a: { k: "catalogo" } }, { t: "Ejemplo de pedido", a: { k: "ejemplo" } }], 350);
      }
      async function catalogo(intro) {
        await hablar([P(intro || "Estos son los productos que puedo cotizar (precio por caja, sin IGV):"), { k: "catalogo", items: indice.filter(function (p) { return p.cotizable; }).map(function (p) { return { nombre: p.nombre, presentacion: p.presentacion, precio: p.precio }; }) },
          P("Dígame producto y cantidad, por ejemplo «200 cajas de evaporada y 50 de yogurt fresa».")]);
      }
      async function estado() {
        var c = C(), pe = pendientes(), of = ofrecidas();
        if (c.cerrado) { await hablar([P("Su pedido " + c.pedido + " ya está registrado. ¿Necesita algo más?")], [{ t: "Hacer otro pedido", a: { k: "nuevo" } }]); return; }
        if (!pe.length && !of.length) { await hablar([P("No tengo ninguna solicitud en curso con usted. ¿Qué necesita cotizar?")]); return; }
        var bl = [];
        pe.forEach(function (q) {
          var t = tareaDe(q, q.estado === "PENDIENTE_FINANZAS" ? "CREDITO" : "DESCUENTO");
          bl.push({ k: "espera", rol: q.estado === "PENDIENTE_FINANZAS" ? "Finanzas" : "Jefatura Comercial", texto: (q.estado === "PENDIENTE_FINANZAS" ? "Crédito" : "Descuento de " + pct(q.desc)) + " en validación (" + q.etiqueta + ")" + (t ? " · " + hace(t.creada) : "") });
        });
        bl.push(P(pe.length ? "Todavía no hay respuesta; apenas la tenga se la comunico." : ""));
        of.forEach(function (q) { bl.push(P("Tiene disponible " + q.etiqueta + " con " + pct(q.desc) + ", total " + soles(q.cot.totales.total) + ".")); });
        await hablar(bl.filter(function (b) { return b.k !== "p" || b.t; }), of.length ? [{ t: "Confirmo " + of[0].etiqueta, a: { k: "aceptar", q: of[0].etiqueta } }] : []);
      }

      // --------------------------------------------------------------------- despacho
      async function atender(texto, accion) {
        var c = C();
        if (texto) emit("msg", { rol: "cliente", texto: texto });
        if (!accion && texto) emit("escribiendo", true);
        var p = null;
        if (!accion) {
          var cx = contextoInterprete(c);
          try {
            var ext = opts.interprete ? await opts.interprete(texto, cx) : null;
            p = ext ? sanear(Object.assign({ texto: texto }, ext)) : null;
            if (p && !utilExterno(p)) { p = null; cx.sinEntender = true; } // el modelo no entendió nada: se prueba con las reglas
          } catch (e) { p = null; emit("error", e); }
          var origen = p ? "modelo de lenguaje" : "reglas";
          if (!p) p = interpretarReglas(texto); // si el intérprete externo falla o no entiende, se usa el de reglas
          if (origen === "reglas" && !p.lineas.length && !p.intent && !p.noDisponible) p.noDisponible = adivinarNoDisponible(texto);
          traza("Agente (CRM)", "Interpreta el mensaje con " + origen + (origen === "reglas" && (cx.sinEntender || cx.motivoFallo) ? " (" + (cx.sinEntender ? "el modelo no encontró ningún pedido ni intención en el mensaje" : "el modelo no respondió: " + cx.motivoFallo) + ")" : ""), "info", (p.lineas.length ? p.lineas.map(function (l) { return (l.id || (l.opciones ? "¿" + l.opciones.join("/") + "?" : "?")) + " × " + (l.cajas === null ? "sin cantidad" : l.cajas); }).join(" · ") : "sin productos") + (p.desc !== null ? " · descuento " + p.desc + " %" : "") + (p.entrega ? " · entrega " + p.entrega : "") + (p.intent ? " · intención " + p.intent : ""));
          // completar según la pregunta abierta
          if (c.preguntando && c.preguntando.tipo === "producto" && p.lineas.length === 1 && p.lineas[0].id && c.preguntando.opciones.indexOf(p.lineas[0].id) >= 0 && p.lineas[0].cajas === null) {
            p.lineas[0].cajas = c.preguntando.cajas; c.preguntando = null;
          } else if (c.preguntando && c.preguntando.tipo === "cantidad" && !p.lineas.length && p.cantidadSuelta !== null) {
            p.lineas = [{ id: c.preguntando.id, opciones: null, cajas: p.cantidadSuelta }]; p.cantidadSuelta = null; c.preguntando = null;
          }
        }
        emit("escribiendo", false);
        // ----- acciones de botón (deterministas)
        if (accion) {
          switch (accion.k) {
            case "aceptar": return aceptar(buscarQ(accion.q));
            case "elegir": { var pq = c.preguntando; var cajas = pq ? pq.cajas : null; c.preguntando = null; return procesarPedido({ lineas: [{ id: accion.id, opciones: null, cajas: cajas }], norm: "", agregar: false, quitar: false, entrega: null, asap: false, unidades: false, desc: null }); }
            case "cantidad": c.preguntando = null; return procesarPedido({ lineas: [{ id: accion.id, opciones: null, cajas: accion.n }], norm: "", agregar: false, quitar: false, entrega: null, asap: false, unidades: false, desc: null });
            case "desc": return pedirDescuento(accion.n);
            case "pedir_desc": return pedirDescuento(null);
            case "esperar": return hablar([P("Perfecto, quedo atenta a la respuesta de la Jefatura y se la comunico en cuanto llegue.")], [], 350);
            case "estado": return estado();
            case "catalogo": return catalogo();
            case "ejemplo": return atender("Quiero 100 cajas de leche UHT entera y 60 de evaporada para el viernes", null);
            case "nuevo": S.conv = nuevaConversacion(c.cliente); return hablar([P("Con gusto. ¿Qué productos y cuántas cajas necesita?")], [{ t: "Ver catálogo", a: { k: "catalogo" } }], 350);
            case "ayuda_ajuste": return hablar([P("Dígame las cantidades que prefiere, por ejemplo «cambia a 30 cajas de UHT entera», y le cotizo de nuevo.")], [], 350);
            case "rechazar_plan": {
              var qp = buscarQ(accion.q); if (!qp) return;
              var ent = entradaDe(qp, true); if (!qp.solId) { S.solSeq += 1; qp.solId = cfg.prefijo_solicitud + pad(S.solSeq, 4); ent.solicitud.id = qp.solId; }
              var rr = M.confirmarPromesa(ent, datos, cfg, S.erp, hoyFn(), false); bitacora(rr, ent); registrarERP(rr, qp.etiqueta);
              traza("ERP", "El cliente rechazó la entrega en dos momentos: sin pedido ni reserva", "alerta", rr.mensaje);
              return tratarRespuesta(qp, rr);
            }
            case "solo_disponible": {
              var qd = buscarQ(accion.q), pr = qd && qd.prev && qd.prev.res && qd.prev.res.stock; if (!pr) return;
              c.borrador.lineas = pr.lineas.map(function (l) { return { id_producto: l.id_producto, cajas: Math.min(l.solicitadas, l.disponibles) }; }).filter(function (l) { return l.cajas > 0; });
              if (!c.borrador.lineas.length) return hablar([P("Hoy no hay stock liberado de esos productos. ¿Desea cotizar otros?")]);
              return cotizarBorrador("De acuerdo, ajusto su pedido a lo que hay disponible hoy.");
            }
            case "consultar_plan": {
              var qc = buscarQ(accion.q); if (!qc) return;
              if (tareaDe(qc, "REPOSICION")) return hablar([P("Ya consulté con Planeamiento; le aviso apenas respondan.")]);
              var pend = (qc.prev && qc.prev.res && qc.prev.res.pendientes || []).filter(function (x) { return /Planeamiento/.test(x.rol); })[0];
              crearTarea({ rol: "Planeamiento / Producción (PP-PI)", tipo: "REPOSICION", etiqueta: qc.etiqueta, cliente: c.cliente, titulo: "Sustentar fecha para el faltante de " + qc.etiqueta, detalle: pend ? pend.detalle : "Faltante sin reposición programada." });
              return hablar([P("Listo, consulté con Planeamiento si pueden sustentar una fecha para el faltante. Le aviso aquí apenas respondan."), { k: "espera", rol: "Planeamiento", texto: "Fecha de reposición en consulta (" + qc.etiqueta + ")" }]);
            }
          }
          return;
        }
        // ----- texto libre
        if (p.noDisponible && !p.lineas.length && (!c.preguntando || p.intent === "catalogo" || !p.intent)) {
          return catalogo("No contamos con " + p.noDisponible + " por ahora, pero estos son los productos que sí tenemos (precio por caja, sin IGV):");
        }
        if (p.noDisponible && p.lineas.length) await hablar([P("No contamos con " + p.noDisponible + ", así que le preparo la cotización con el resto de su pedido.")], [], 350);
        if (p.intent === "nuevo") return atender(null, { k: "nuevo" });
        if (p.unidades && !p.lineas.length) return hablar([P("Nosotros vendemos por caja (por ejemplo, la leche UHT viene en cajas de 12 envases). Dígame qué producto y cuántas cajas necesita.")], [{ t: "Ver catálogo", a: { k: "catalogo" } }]);
        if (p.intent === "catalogo" && p.lineas.every(function (l) { return l.cajas === null; })) return catalogo(); // "¿qué leches hay?": muestra el catálogo en vez de pedir que elija
        if (p.lineas.length) return procesarPedido(p);
        if (c.preguntando && c.preguntando.tipo === "cantidad" && p.cantidadSuelta === null) { /* sigue sin cantidad */ }
        if (p.cantidadSuelta !== null && c.borrador.lineas.length === 1 && !c.cerrado && /\b(cambia|cambiar|mejor|ahora|solo|modifica|prefiero|en vez)\b/.test(p.norm)) {
          return procesarPedido({ lineas: [{ id: c.borrador.lineas[0].id_producto, opciones: null, cajas: p.cantidadSuelta }], norm: p.norm, agregar: false, quitar: false, entrega: p.entrega, asap: p.asap, unidades: false, desc: p.desc });
        }
        if (p.desc !== null || p.descMenciona) return pedirDescuento(p.desc);
        if (p.entrega || p.asap) {
          if (c.borrador.lineas.length && !c.cerrado) {
            c.borrador.entrega = p.entrega || sumaDias(hoyFn(), cfg.dias_entrega_defecto);
            ofrecidas().forEach(function (q) { q.estado = "REEMPLAZADA"; });
            return cotizarBorrador("Anoté la entrega para el " + fmtFL(c.borrador.entrega) + ".");
          }
          return hablar([P("Anoté la fecha de entrega (" + fmtFL(p.entrega || sumaDias(hoyFn(), cfg.dias_entrega_defecto)) + "). ¿Qué productos y cuántas cajas necesita?")]);
        }
        switch (p.intent) {
          case "saludo": return saludo();
          case "catalogo": return catalogo();
          case "ayuda": return hablar([P("Puedo cotizarle productos de Gloria, aplicar descuentos dentro de mi facultad (hasta " + pct(EJ) + "), pedir a la Jefatura los de " + pct(EJ) + " a " + pct(JE) + ", confirmar stock y crédito, y registrar su pedido cuando usted lo acepte."), P("Pruebe escribiendo: «300 cajas de evaporada para el lunes con 8 % de descuento».")], [{ t: "Ver catálogo", a: { k: "catalogo" } }]);
          case "estado": return estado();
          case "gracias": return hablar([P("A usted. Quedo atenta por si necesita algo más.")], [], 350);
          case "quien_soy": return quienSoy();
          case "otro": return hablar([P("Eso se sale de lo que puedo resolverle por aquí: yo me ocupo de cotizaciones y pedidos de los productos Gloria."), P("Cuénteme qué necesita, por ejemplo «80 cajas de yogurt de fresa para el jueves», o pídame el catálogo.")], [{ t: "Ver catálogo", a: { k: "catalogo" } }], 350);
          case "identidad": return hablar([P("Soy la asistente virtual de Gloria. Me encargo de prepararle la cotización, aplicar los descuentos que me corresponden, consultar con la Jefatura los que no, y acompañar su pedido hasta que quede confirmado."), P("¿Qué productos y cuántas cajas necesita?")], [{ t: "Ver catálogo", a: { k: "catalogo" } }], 350);
          case "acepta": {
            if (c.cerrado) return hablar([P("Su pedido " + c.pedido + " ya está registrado. ¿Desea hacer otro?")], [{ t: "Hacer otro pedido", a: { k: "nuevo" } }]);
            var sel = elegirCotizacion();
            if (sel.q && sel.duda) {
              var pe = pendientes()[0];
              return hablar([P("Tengo dos opciones en curso: " + sel.q.etiqueta + " con " + pct(sel.q.desc) + " (lista para confirmar) y " + pe.etiqueta + " con " + pct(pe.desc) + " (esperando a la Jefatura). ¿Cuál prefiere?")],
                [{ t: "Confirmo " + sel.q.etiqueta + " (" + pct(sel.q.desc) + ")", a: { k: "aceptar", q: sel.q.etiqueta } }, { t: "Espero la respuesta", a: { k: "esperar" } }]);
            }
            if (sel.q) return aceptar(sel.q);
            if (sel.pendiente) return estado();
            var fin = c.cots.filter(function (q) { return q.estado === "PENDIENTE_FINANZAS"; })[0];
            if (fin) return estado();
            return hablar([P("Aún no tengo una cotización vigente para confirmar. ¿Qué productos y cuántas cajas necesita?")]);
          }
          case "niega": {
            var vivas = ofrecidas().concat(pendientes());
            vivas.forEach(function (q) { if (q.estado === "PENDIENTE_JEFATURA") { var t = tareaDe(q, "DESCUENTO"); if (t) cerrarTarea(t, "ANULADA", "El cliente desistió."); } q.estado = "CERRADA"; });
            if (!vivas.length) return hablar([P("De acuerdo. ¿Necesita algo más?")], [], 350);
            c.cerrado = true; return hablar([P("Entendido, dejo sin efecto la cotización. Cuando quiera retomamos.")], [{ t: "Hacer otro pedido", a: { k: "nuevo" } }], 350);
          }
        }
        return hablar([P("No logré identificar qué necesita. Indíqueme producto y cantidad (por ejemplo «100 cajas de leche UHT entera»), o escriba «catálogo» para ver lo que puedo cotizar.")], [{ t: "Ver catálogo", a: { k: "catalogo" } }]);
      }

      // ------------------------------------------------------------------- API pública
      if (opts.estado && opts.estado.conv) restaurar(opts.estado); else reiniciarTodo(opts.cliente, true);
      return {
        recibir: function (texto, accion) {
          S.cola = S.cola.then(function () { return atender(texto, accion || null); }).catch(function (e) { emit("error", e); try { decir([P("Tuve un problema interno al procesar su mensaje. Intente de nuevo.")]); } catch (x) { /* nada */ } });
          return S.cola;
        },
        resolver: function (id, dec) { var o; S.cola = S.cola.then(function () { return resolverTarea(id, dec).then(function (r) { o = r; }); }).catch(function (e) { emit("error", e); o = { ok: false, error: String(e && e.message || e) }; }); return S.cola.then(function () { return o; }); },
        saludar: function () { S.cola = S.cola.then(saludo); return S.cola; },
        setCliente: function (id) { S.conv = nuevaConversacion(id); S.msgs = []; S.cola = S.cola.then(function () { emit("cliente", id); }); return S.cola; },
        reiniciar: function (id) { reiniciarTodo(id || C().cliente); return Promise.resolve(); },
        exportar: function () { return JSON.parse(JSON.stringify(S, function (k, v) { return k === "cola" ? undefined : v; })); },
        vista: function () { return { cliente: C().cliente, conv: C(), tareas: S.tareas, traza: S.traza, ultimoERP: S.ultimoERP, rev: S.rev, seq: S.seq }; },
        mensajesDesde: function (desde) { return S.msgs.filter(function (m) { return m.seq > (desde || 0); }); },
        estado: function () { return S; },
        datos: function () { return datos; },
        interpretar: interpretarReglas,
        csv: function () { return M.bitacoraACsv(S.bit); },
        utiles: { fmtF: fmtF, fmtFL: fmtFL, soles: soles, pct: pct }
      };
    }
  };
});
