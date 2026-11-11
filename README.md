# Agente comercial por chat · caso Gloria · GE703 PC3 (Grupo 6)

Simulador académico: el cliente escribe su pedido, el agente cotiza, valida el descuento y, si el cliente pide otro, **espera** la decisión de la persona con autoridad (bandeja interna). Datos ficticios.

## Cómo está armado

```
Navegador (public/index.html)  ──fetch──▶  /api/op, /api/estado, /api/bitacora   (funciones de Vercel)
                                                │  lib/servicio.js  → lib/core.js (agente) → lib/motor.js (ERP: controles C0–C4)
                                                ▼
                                       Supabase (Postgres): productos, clientes, stock_lotes, aprobaciones, sesiones
```

- Las **reglas y validaciones corren en el servidor**, no en el navegador: el visitante no puede saltárselas.
- El servidor no recuerda nada entre peticiones; el estado de cada visitante está en la tabla `sesiones` (una fila por visitante).
- Para modificar la página: edite `web/ui.js`, `web/style.css` o `web/template.html` y ejecute `python3 web/build.py` (genera `public/index.html`). Si no toca la pantalla, no hace falta.

## Puesta en línea, paso a paso

### 1. Supabase (base de datos)
1. En supabase.com cree un **New project** (nombre libre, elija una contraseña de base de datos y **guárdela**).
2. Cuando termine de crearse, abra **SQL Editor → New query**, pegue todo el contenido de `supabase/schema.sql` y pulse **Run**. Debe terminar sin errores.
3. Pulse el botón **Connect** (arriba), elija **Transaction pooler** y copie el **URI** (puerto 6543, host `...pooler.supabase.com`). Reemplace `[YOUR-PASSWORD]` por su contraseña. Ese texto es su `DATABASE_URL`.
   - No use la conexión "Direct": no funciona bien desde Vercel.

### 2. GitHub (código)
1. Descomprima este proyecto en su computador.
2. En github.com: **New repository** (puede ser privado), sin README.
3. En el repositorio nuevo: **uploading an existing file** y arrastre **el contenido** de la carpeta (carpetas `api`, `lib`, `public`, `supabase`, `web` y los archivos `package.json`, `vercel.json`, `.gitignore`, `README.md`). **No** suba `node_modules`. Luego **Commit changes**.

### 3. Vercel (publicación)
1. En vercel.com: **Add New → Project**, importe el repositorio de GitHub.
2. Deje la configuración por defecto (el `vercel.json` ya indica que no hay compilación y que la carpeta pública es `public`).
3. Abra **Environment Variables** y agregue: nombre `DATABASE_URL`, valor el URI del paso 1.3. Pulse **Deploy**.
4. Al terminar, Vercel le da un enlace `https://….vercel.app`. Ese es el enlace para el profesor.

### 4. Probar
Abra el enlace en una ventana de incógnito: debe saludar el agente. Pruebe la pestaña **Escenarios**. Si algo falla, en Vercel: proyecto → **Logs** muestra el error.

## Probar en su computador (opcional)
Requiere Node 20+ y un Postgres local con `supabase/schema.sql` cargado:
```
npm install
DATABASE_URL=postgres://usuario:clave@localhost:5432/base node dev-server.js
```
y abra http://localhost:3000.

## Notas
- Cada visitante tiene su propia sesión (identificador guardado en su navegador); las sesiones de más de 7 días se borran solas.
- Las tablas tienen RLS activado y sin políticas: la API pública de Supabase no puede leerlas; solo el servidor (con su `DATABASE_URL`) accede.
- No comparta el `DATABASE_URL` ni lo suba a GitHub.

## Intérprete con modelo de lenguaje (opcional)
Por defecto el agente interpreta los mensajes con reglas. Si define una clave en Vercel (Settings → Environment Variables, para Production y Preview) y vuelve a desplegar, un modelo de lenguaje traduce el mensaje del cliente a datos (productos, cajas, descuento pedido, fecha, intención).

| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `GEMINI_API_KEY` | una de las dos | Clave de Google AI Studio (aistudio.google.com/apikey). Tiene capa gratuita, sin tarjeta. Si está definida, se usa Gemini. |
| `ANTHROPIC_API_KEY` | una de las dos | Clave de la API de Anthropic (de pago por uso). Solo se usa si no hay `GEMINI_API_KEY`. |
| `LLM_MODEL` | no | Modelo a usar. Por defecto `gemini-2.5-flash-lite` (Gemini) o `claude-haiku-5-5` (Anthropic). Confirme en AI Studio qué modelos tiene su capa gratuita. |
| `LLM_MAX_POR_SESION` | no | Tope de llamadas al modelo por visitante. Por defecto 60. |

- El modelo **solo traduce**. Precio, descuento autorizado, stock y crédito los sigue decidiendo el motor, y todo lo que devuelve el modelo se valida contra el catálogo (`sanear()` en `lib/core.js`).
- Sin clave, con error de red, con límite de cuota agotado (error 429) o si el modelo no entiende, se usa el intérprete por reglas: el agente nunca se queda sin responder.
- En la capa gratuita de Gemini, Google puede usar los mensajes enviados para mejorar sus productos. Aquí todo son datos ficticios; no escriba datos reales de clientes.
- Si usa la capa de pago de cualquier proveedor, configure un límite de gasto mensual: el enlace es público.
