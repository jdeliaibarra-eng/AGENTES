/* Cliente de la API: misma interfaz que el agente en el navegador, pero el cerebro vive en el servidor (Vercel + Supabase). */
(function () {
  "use strict";
  var NOM_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  function diaSemana(iso) { return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay(); }
  function fmtF(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : ""; }
  function fmtFL(iso) { return iso ? NOM_DIA[diaSemana(iso)] + " " + fmtF(iso) : ""; }
  function soles(x) { return "S/ " + Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(x) { return String(Number(Number(x).toFixed(2))) + " %"; }

  function nuevoId() {
    var a = new Uint8Array(18), s = "", i, abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    try { crypto.getRandomValues(a); } catch (e) { for (i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    for (i = 0; i < a.length; i++) s += abc.charAt(a[i] % abc.length);
    return "s" + s;
  }
  function sesionId() {
    var id = null;
    try { id = localStorage.getItem("agente_sesion"); } catch (e) { /* almacenamiento no disponible */ }
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      id = nuevoId();
      try { localStorage.setItem("agente_sesion", id); } catch (e) { /* nada */ }
    }
    return id;
  }

  var VISTA_VACIA = function () { return { cliente: null, conv: { cots: [], cerrado: false, pedido: null }, tareas: [], traza: [], ultimoERP: null, rev: 0, seq: 0 }; };

  window.ChatAgenteApi = {
    crear: function (opts) {
      var emitExterno = opts.emit || function () {}, base = opts.base || "", getFecha = opts.fecha || function () { return "2026-11-10"; };
      var sid = sesionId(), cliente = opts.cliente || "CLI-001", vista = VISTA_VACIA();
      var ultimoSeq = 0, ultimoRev = -1, cola = Promise.resolve(), ocupado = 0, pendCli = 0, gen = 0;

      function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
      function emit(ev, d) { try { emitExterno(ev, d); } catch (e) { if (window.console) console.error(e); } }
      function paneles() { emit("tareas", null); emit("traza", null); emit("erp", null); }
      function duracion(m) {
        var n = 0; (m.bloques || []).forEach(function (b) { if (b.t) n += b.t.length; else n += 60; });
        return Math.max(450, Math.min(1300, 300 + n * 7));
      }

      function pedir(url, init) { // con tiempo máximo: si el servidor no responde, el chat lo avisa en vez de quedarse en blanco
        var ctl = typeof AbortController !== "undefined" ? new AbortController() : null, tm = null;
        if (ctl) { init = Object.assign({}, init, { signal: ctl.signal }); tm = setTimeout(function () { ctl.abort(); }, 28000); }
        return fetch(base + url, init).catch(function (e) { throw new Error(e && e.name === "AbortError" ? "el servidor tardó demasiado" : "sin conexión con el servidor"); }).finally(function () { if (tm) clearTimeout(tm); }).then(function (r) {
          return r.json().catch(function () { return { ok: false, error: "Respuesta inválida del servidor." }; }).then(function (j) {
            if (!j.ok) { var e = new Error(j.error || "Error del servidor."); throw e; }
            return j;
          });
        });
      }
      function llamar(body) {
        body.sesion = sid; body.fecha = getFecha(); body.cliente = cliente; body.desde = ultimoSeq;
        return pedir("/api/op", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      // Reproduce los mensajes nuevos (con la animación de "escribiendo…") y después actualiza los paneles.
      function aplicar(j, conAnimacion) {
        var miGen = gen, nuevos = (j.nuevos || []).slice().sort(function (a, b) { return a.seq - b.seq; });
        var p = Promise.resolve();
        nuevos.forEach(function (m) {
          if (m.seq <= ultimoSeq) return;
          ultimoSeq = m.seq;
          if (m.rol === "cliente" && pendCli > 0) { pendCli--; return; }
          p = p.then(function () {
            if (miGen !== gen) return;
            if (m.rol !== "cliente" && conAnimacion) {
              emit("escribiendo", true);
              return esperar(duracion(m)).then(function () { emit("escribiendo", false); if (miGen === gen) emit("msg", m); });
            }
            emit("msg", m);
          });
        });
        return p.then(function () {
          if (miGen !== gen) return;
          var cambio = !j.vista || j.vista.rev !== ultimoRev; // si no cambió nada (p. ej. una aprobación rechazada por el ERP) no se repinta, para conservar el aviso de error
          if (j.vista) { vista = j.vista; ultimoRev = j.vista.rev; if (j.vista.cliente) { if (j.vista.cliente !== cliente) { cliente = j.vista.cliente; emit("cliente", cliente); } } }
          if (cambio) paneles();
        });
      }

      function enColaCon(fn) {
        ocupado++;
        var p = cola.then(fn);
        cola = p.then(function () { ocupado--; }, function () { ocupado--; });
        return p;
      }

      function falla(e) {
        emit("escribiendo", false);
        emit("msg", { rol: "agente", seq: null, ts: Date.now(), bloques: [{ k: "p", t: "No pude comunicarme con el servidor (" + (e && e.message || "error") + "). Intente nuevamente en unos segundos." }], chips: [] });
      }

      function reiniciarLocal() { gen++; ultimoSeq = 0; ultimoRev = -1; pendCli = 0; vista = VISTA_VACIA(); emit("todo", null); }

      var API = {
        recibir: function (texto, accion) {
          pendCli++;
          emit("msg", { rol: "cliente", texto: texto, seq: null, ts: Date.now() });
          return enColaCon(function () {
            return llamar({ op: "recibir", texto: texto, accion: accion || null }).then(function (j) { return aplicar(j, true); }).catch(function (e) { pendCli = Math.max(0, pendCli - 1); falla(e); });
          });
        },
        resolver: function (id, dec) {
          return enColaCon(function () {
            return llamar({ op: "resolver", tarea: id, dec: dec }).then(function (j) { return aplicar(j, true).then(function () { return j.resultado || { ok: true }; }); })
              .catch(function (e) { return { ok: false, error: e.message || "Error del servidor." }; });
          });
        },
        saludar: function () { // abre la sesión: si ya existía en el servidor, recupera la conversación
          return enColaCon(function () {
            reiniciarLocal();
            return llamar({ op: "iniciar", desde: 0 }).then(function (j) { return aplicar(j, false); }).catch(falla);
          });
        },
        setCliente: function (id) {
          cliente = id; reiniciarLocal();
          return enColaCon(function () { return llamar({ op: "cliente", desde: 0 }).then(function (j) { return aplicar(j, true); }).catch(falla); });
        },
        reiniciar: function (id) {
          if (id) cliente = id; reiniciarLocal();
          return enColaCon(function () { return llamar({ op: "reiniciar", desde: 0 }).then(function (j) { return aplicar(j, true); }).catch(falla); });
        },
        csv: function () {
          return pedir("/api/bitacora?sesion=" + encodeURIComponent(sid), {}).catch(function () { return null; });
        },
        estado: function () { return vista; },
        utiles: { fmtF: fmtF, fmtFL: fmtFL, soles: soles, pct: pct }
      };

      // El CSV no es JSON: pedir() no sirve para él.
      API.csv = function () {
        return fetch(base + "/api/bitacora?sesion=" + encodeURIComponent(sid)).then(function (r) { return r.text(); }).catch(function () { return "No se pudo leer la bitácora."; });
      };

      // Sondeo suave: si cambió algo en el servidor (otra pestaña, otro dispositivo con la misma sesión) lo refleja.
      function sondear() {
        if (ocupado || (typeof document !== "undefined" && document.hidden)) return;
        var desde = ultimoSeq;
        fetch(base + "/api/estado?sesion=" + encodeURIComponent(sid) + "&desde=" + desde).then(function (r) { return r.json(); }).then(function (j) {
          if (!j || !j.ok || !j.existe || ocupado || desde !== ultimoSeq) return;
          if (j.vista.seq < ultimoSeq) { API.saludar(); return; }
          if ((j.nuevos && j.nuevos.length) || j.vista.rev !== ultimoRev) aplicar(j, false);
        }).catch(function () { /* sin red: se reintenta en el próximo ciclo */ });
      }
      setInterval(sondear, opts.sondeoMs || 6000);

      return API;
    }
  };
})();
