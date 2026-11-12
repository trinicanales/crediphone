#!/usr/bin/env node
/**
 * MAPA AUTOMÁTICO DEL SISTEMA (solo lectura). Uso, desde la raíz del repo:
 *   node scripts/mapa-sistema.js                 -> genera .claude/mapa/D-grafo-codigo.md y .claude/mapa/grafo.json
 *   node scripts/mapa-sistema.js --impacto X     -> qué páginas/APIs/componentes se afectan si cambias X
 *        X puede ser una tabla (ventas), una ruta API (/api/pos/ventas), un archivo (src/lib/db/ventas.ts) o una columna (ventas.estado)
 * Lee el código (no de memoria) y la foto del esquema scripts/audit-schema.json. Refrescar esa foto tras cada migración.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BS = String.fromCharCode(92);
const norm = (p) => p.split(BS).join("/");
const OUT_DIR = path.join(ROOT, ".claude", "mapa");

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walk(p, out); }
    else out.push(p);
  }
  return out;
}

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "audit-schema.json"), "utf8"));
const TABLAS = new Set(Object.keys(schema));
const files = {};
for (const f of walk(path.join(ROOT, "src"))) {
  const rel = norm(path.relative(ROOT, f));
  if (/\.(ts|tsx)$/.test(rel)) files[rel] = fs.readFileSync(f, "utf8");
}

// ── rutas y páginas ─────────────────────────────────────────────────────────
const rutas = {};   // url -> archivo
const paginas = {}; // url -> archivo
for (const rel of Object.keys(files)) {
  let m = rel.match(/^src\/app\/(api\/.*)\/route\.ts$/);
  if (m) rutas["/" + m[1]] = rel;
  m = rel.match(/^src\/app\/(.*?)\/?page\.tsx$/);
  if (m) paginas["/" + m[1]] = rel;
}
const rutaRegex = Object.entries(rutas).map(([url, file]) => ({
  url, file, re: new RegExp("^" + url.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+") + "$"),
}));

// ── imports ─────────────────────────────────────────────────────────────────
function resolverImport(desde, spec) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = norm(path.join(path.dirname(desde), spec));
  else return null;
  for (const cand of [base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx", base]) {
    if (files[cand] !== undefined) return cand;
  }
  return null;
}
const imports = {};
for (const [rel, txt] of Object.entries(files)) {
  const set = new Set();
  for (const m of txt.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
    const r = resolverImport(rel, m[1]);
    if (r) set.add(r);
  }
  imports[rel] = [...set];
}

// ── tablas, escrituras, rpc, llamadas a API por archivo ─────────────────────
const info = {};
for (const [rel, txt] of Object.entries(files)) {
  const lee = new Set(), escribe = new Set(), rpc = new Set(), apis = new Set(), fantasmas = new Set();
  const re = /\.from\(\s*["'`]([a-z_0-9]+)["'`]\s*\)/g;
  let m;
  while ((m = re.exec(txt))) {
    const t = m[1];
    const sig = txt.slice(m.index, m.index + 500);
    const cortar = sig.slice(10).search(/\.from\(/);
    const tramo = cortar >= 0 ? sig.slice(0, cortar + 10) : sig;
    (/\.(insert|update|delete|upsert)\(/.test(tramo) ? escribe : lee).add(t);
    if (!TABLAS.has(t)) fantasmas.add(t);
  }
  for (const r of txt.matchAll(/\.rpc\(\s*["'`]([a-z_0-9]+)["'`]/g)) rpc.add(r[1]);
  for (const r of txt.matchAll(/["'`](?:\$\{[^}]*\})?(\/api\/[^"'`\s]*)["'`]/g)) {
    // ${qs} pegado al final de un segmento = querystring, no parte de la ruta
    let u = r[1].replace(/([^/])\$\{[^}]*\}$/, "$1").replace(/\$\{[^}]*\}/g, "x").split("?")[0].replace(/\/+$/, "");
    const hit = rutaRegex.find((x) => x.re.test(u));
    if (hit) apis.add(hit.url);
  }
  info[rel] = { lee, escribe, rpc, apis, fantasmas };
}

// ── cierre transitivo ───────────────────────────────────────────────────────
function cierre(inicio, filtro, prof) {
  const vistos = new Set([inicio]);
  let frontera = [inicio];
  for (let d = 0; d < prof; d++) {
    const sig = [];
    for (const f of frontera) for (const i of imports[f] || []) {
      if (!vistos.has(i) && filtro(i)) { vistos.add(i); sig.push(i); }
    }
    frontera = sig;
  }
  return [...vistos];
}
const esLib = (f) => /^src\/lib\//.test(f);
const esUI = (f) => /^src\/(components|hooks|lib\/offline)\//.test(f) || /\/page\.tsx$/.test(f) === false && /^src\/app\/.*\.tsx$/.test(f) === false ? /^src\/(components|hooks)\//.test(f) : true;

const apiInfo = {};
for (const [url, file] of Object.entries(rutas)) {
  const archivos = cierre(file, esLib, 3);
  const lee = new Set(), escribe = new Set(), rpc = new Set();
  for (const a of archivos) { info[a].lee.forEach((t) => lee.add(t)); info[a].escribe.forEach((t) => escribe.add(t)); info[a].rpc.forEach((r) => rpc.add(r)); }
  apiInfo[url] = { file, lee: [...lee], escribe: [...escribe], rpc: [...rpc], libs: archivos.filter((a) => a !== file), llamadores: [] };
}
const paginaInfo = {};
for (const [url, file] of Object.entries(paginas)) {
  // Se corta en componentes GLOBALES (sesión, menú, notificaciones): vienen en todas las páginas y ensucian el mapa
  const GLOBAL = /(AuthProvider|ConfigProvider|DistribuidorProvider|ThemeProvider|components\/layout\/|Notificacion|NotificationBell|PushSubscriber|usePush|OfflineBanner|useOnlineStatus)/;
  const archivos = cierre(file, (f) => (/^src\/(components|hooks)\//.test(f) || /^src\/lib\/(offline|reparaciones)\//.test(f)) && !GLOBAL.test(f), 4);
  const apis = new Set();
  for (const a of archivos) info[a].apis.forEach((u) => apis.add(u));
  const tablas = new Set(), escribe = new Set();
  apis.forEach((u) => { apiInfo[u].lee.forEach((t) => tablas.add(t)); apiInfo[u].escribe.forEach((t) => { tablas.add(t); escribe.add(t); }); });
  paginaInfo[url] = { file, componentes: archivos.filter((a) => a !== file && /components/.test(a)).length, apis: [...apis], tablas: [...tablas], escribe: [...escribe] };
}
// llamadores de cada API (cualquier archivo que mencione su URL)
for (const [rel, i] of Object.entries(info)) i.apis.forEach((u) => apiInfo[u].llamadores.push(rel));

// ── sidebar ─────────────────────────────────────────────────────────────────
const sidebarTxt = files["src/components/layout/Sidebar.tsx"] || "";
const enSidebar = new Set([...sidebarTxt.matchAll(/href:\s*["'`](\/[^"'`]*)["'`]/g)].map((m) => m[1]));

// ── hallazgos ───────────────────────────────────────────────────────────────
const externa = /(cron|webhook|auth|public|token|callback|scan-session|payjoy|test-connection|print|storage)/;
const apisHuerfanas = Object.entries(apiInfo).filter(([u, a]) => a.llamadores.length === 0 && !externa.test(u)).map(([u]) => u);
const apisSinAuth = Object.entries(rutas).filter(([u, f]) => !externa.test(u) && !/getAuthContext|requireAuth|auth\.getUser|getUser\(|verificarToken|getSession/.test(files[f])).map(([u]) => u);
const tablaUso = {};
for (const t of TABLAS) tablaUso[t] = { apisLee: [], apisEscribe: [], archivos: [] };
for (const [u, a] of Object.entries(apiInfo)) { a.lee.forEach((t) => TABLAS.has(t) && tablaUso[t].apisLee.push(u)); a.escribe.forEach((t) => TABLAS.has(t) && tablaUso[t].apisEscribe.push(u)); }
for (const [rel, i] of Object.entries(info)) [...i.lee, ...i.escribe].forEach((t) => TABLAS.has(t) && tablaUso[t].archivos.push(rel));
const tablasSinCodigo = [...TABLAS].filter((t) => tablaUso[t].archivos.length === 0);
const tablasFantasma = {};
for (const [rel, i] of Object.entries(info)) i.fantasmas.forEach((t) => (tablasFantasma[t] = tablasFantasma[t] || []).push(rel));
const rpcUsados = {};
for (const [rel, i] of Object.entries(info)) i.rpc.forEach((r) => (rpcUsados[r] = rpcUsados[r] || []).push(rel));

// páginas espejo: comparten muchas tablas
const IGNORAR = new Set(["users", "permisos_empleado", "distribuidores", "configuracion", "push_subscriptions", "notificaciones", "notificaciones_fallidas", "whatsapp_mensajes", "audit_log_accesos"]);
for (const p of Object.values(paginaInfo)) p.tablasNegocio = p.tablas.filter((x) => !IGNORAR.has(x));
const pagsConDatos = Object.entries(paginaInfo).filter(([, p]) => p.tablasNegocio.length >= 3);
const espejos = [];
for (let a = 0; a < pagsConDatos.length; a++) for (let b = a + 1; b < pagsConDatos.length; b++) {
  const A = new Set(pagsConDatos[a][1].tablasNegocio), B = new Set(pagsConDatos[b][1].tablasNegocio);
  const inter = [...A].filter((x) => B.has(x));
  const j = inter.length / (A.size + B.size - inter.length);
  const apisComunes = pagsConDatos[a][1].apis.filter((x) => pagsConDatos[b][1].apis.includes(x));
  if (j >= 0.55 && inter.length >= 3) espejos.push({ a: pagsConDatos[a][0], b: pagsConDatos[b][0], j: Math.round(j * 100), tablas: inter, apisComunes });
}
espejos.sort((x, y) => y.j - x.j);
// quién define su propio mapa de estados (duplicados de etiquetas)
const mapasEstado = Object.entries(files).filter(([rel, t]) => /esperando_piezas/.test(t) && /(label|Label|color|bg:|etiqueta)/.test(t) && !/^src\/(lib\/reparaciones\/estados|types)/.test(rel)).map(([rel]) => rel);
const sidebarSinPagina = [...enSidebar].filter((h) => !paginas[h] && !paginas[h.replace(/\/$/, "")]);
const paginasSinSidebar = Object.keys(paginas).filter((u) => u.startsWith("/dashboard") && !enSidebar.has(u) && !/\[/.test(u));
const gigantes = Object.entries(files).filter(([, t]) => t.split("\n").length > 900).map(([rel, t]) => [rel, t.split("\n").length]).sort((a, b) => b[1] - a[1]);

const grafo = { generado: new Date().toISOString(), rutas: apiInfo, paginas: paginaInfo, tablas: tablaUso, rpc: rpcUsados, imports };

// ── modo impacto ────────────────────────────────────────────────────────────
const idx = process.argv.indexOf("--impacto");
if (idx >= 0) {
  const x = process.argv[idx + 1];
  if (!x) { console.error("Falta el argumento: tabla, /api/ruta, archivo o tabla.columna"); process.exit(1); }
  const out = [];
  const [tabla, columna] = x.includes(".") && !x.includes("/") ? x.split(".") : [x, null];
  if (TABLAS.has(tabla)) {
    out.push(`TABLA ${tabla}${columna ? "." + columna + (schema[tabla].split(",").includes(columna) ? "" : "  (¡NO EXISTE en la BD!)") : ""}`);
    const u = tablaUso[tabla];
    out.push(`  APIs que la ESCRIBEN (${u.apisEscribe.length}): ${u.apisEscribe.join(", ") || "—"}`);
    out.push(`  APIs que la LEEN (${u.apisLee.length}): ${u.apisLee.join(", ") || "—"}`);
    const pags = Object.entries(paginaInfo).filter(([, p]) => p.tablas.includes(tabla)).map(([url]) => url);
    out.push(`  PÁGINAS que dependen de ella (${pags.length}): ${pags.join(", ") || "—"}`);
    out.push(`  Archivos que la mencionan directo (${u.archivos.length}): ${[...new Set(u.archivos)].join(", ")}`);
    if (columna) {
      const tocan = Object.entries(files).filter(([, t]) => new RegExp("\\b" + columna + "\\b").test(t) && new RegExp(tabla).test(t)).map(([r]) => r);
      out.push(`  Archivos que mencionan la columna "${columna}" junto a la tabla (${tocan.length}): ${tocan.join(", ")}`);
    }
  } else if (rutas[x]) {
    const a = apiInfo[x];
    out.push(`API ${x}  (${a.file})`);
    out.push(`  Escribe: ${a.escribe.join(", ") || "—"} | Lee: ${a.lee.join(", ") || "—"} | RPC: ${a.rpc.join(", ") || "—"}`);
    out.push(`  La llaman (${a.llamadores.length}): ${a.llamadores.join(", ") || "NADIE (huérfana o externa)"}`);
    const pags = Object.entries(paginaInfo).filter(([, p]) => p.apis.includes(x)).map(([url]) => url);
    out.push(`  PÁGINAS afectadas: ${pags.join(", ") || "—"}`);
  } else if (files[x]) {
    out.push(`ARCHIVO ${x}`);
    const usan = Object.keys(imports).filter((f) => imports[f].includes(x));
    out.push(`  Lo importan directo (${usan.length}): ${usan.join(", ") || "—"}`);
    const trans = new Set(usan); let fr = [...usan];
    for (let d = 0; d < 4; d++) { const sg = []; for (const f of fr) for (const g of Object.keys(imports)) if (imports[g].includes(f) && !trans.has(g)) { trans.add(g); sg.push(g); } fr = sg; }
    const pags = [...trans].filter((f) => /\/page\.tsx$/.test(f) || /\/route\.ts$/.test(f));
    out.push(`  Páginas/APIs alcanzadas en cadena (${pags.length}): ${pags.join(", ") || "—"}`);
    out.push(`  Tablas que toca: ${[...info[x].lee, ...info[x].escribe].join(", ") || "—"}`);
  } else { console.error("No reconozco: " + x); process.exit(1); }
  console.log(out.join("\n"));
  process.exit(0);
}

// ── escribir informe ────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "grafo.json"), JSON.stringify(grafo, null, 1));
const L = [];
const tabla = (cab, filas) => { L.push("| " + cab.join(" | ") + " |"); L.push("|" + cab.map(() => "---").join("|") + "|"); filas.forEach((f) => L.push("| " + f.join(" | ") + " |")); L.push(""); };
L.push(`# D · Grafo automático del código (páginas → APIs → tablas)`);
L.push(`> Generado por \`node scripts/mapa-sistema.js\` el ${grafo.generado.slice(0, 10)}. Lee el código real; la foto del esquema es \`scripts/audit-schema.json\` (se refresca tras cada migración). Consulta de impacto: \`node scripts/mapa-sistema.js --impacto <tabla|/api/ruta|archivo|tabla.columna>\`.`);
L.push(`> Alcance de la lectura: detecta \`.from("tabla")\`, \`.rpc()\`, \`fetch("/api/…")\` e imports. No ve consultas armadas dinámicamente ni las llamadas hechas desde fuera del código (webhooks, cron externo).`);
L.push("");
L.push(`## Resumen`);
L.push(`- Archivos TS/TSX: **${Object.keys(files).length}** · APIs: **${Object.keys(rutas).length}** · Páginas: **${Object.keys(paginas).length}** · Tablas/vistas en BD: **${TABLAS.size}**`);
L.push(`- APIs que nadie llama (sin contar webhook/cron/auth/público): **${apisHuerfanas.length}** · APIs sin ninguna validación de sesión visible: **${apisSinAuth.length}** · Tablas sin ningún uso en el código: **${tablasSinCodigo.length}** · Tablas referenciadas que NO existen: **${Object.keys(tablasFantasma).length}**`);
L.push(`- Archivos con su propio mapa de estados/etiquetas (fuera de estados.ts): **${mapasEstado.length}** · Archivos > 900 líneas: **${gigantes.length}**`);
L.push("");
L.push(`## 1. Páginas → APIs → tablas`);
tabla(["Página", "Archivo", "Comp.", "APIs", "Tablas que lee/escribe", "Escribe"], Object.entries(paginaInfo).sort().map(([u, p]) => [`\`${u}\``, `\`${p.file.replace("src/app/", "")}\``, p.componentes, p.apis.length, p.tablas.join(", ") || "—", p.escribe.join(", ") || "—"]));
L.push(`## 2. APIs → tablas (lee/escribe) y quién las llama`);
tabla(["API", "Escribe", "Lee", "RPC", "Llamadores"], Object.entries(apiInfo).sort().map(([u, a]) => [`\`${u}\``, a.escribe.join(", ") || "—", a.lee.join(", ") || "—", a.rpc.join(", ") || "—", a.llamadores.length]));
L.push(`## 3. Tablas → quién las escribe y quién las lee`);
tabla(["Tabla", "APIs que escriben", "APIs que leen", "Archivos"], [...TABLAS].sort().map((t) => [`\`${t}\``, tablaUso[t].apisEscribe.length, tablaUso[t].apisLee.length, [...new Set(tablaUso[t].archivos)].length]));
L.push(`## 4. Hallazgos automáticos`);
L.push(`### 4.1 Tablas/vistas SIN ningún uso en el código (${tablasSinCodigo.length})\n${tablasSinCodigo.map((t) => "`" + t + "`").join(", ") || "—"}\n`);
L.push(`### 4.2 Tablas que el código usa y NO existen en la BD (${Object.keys(tablasFantasma).length})`);
Object.entries(tablasFantasma).forEach(([t, fs2]) => L.push(`- \`${t}\` → ${fs2.join(", ")}`));
L.push("");
L.push(`### 4.3 APIs que nadie llama (${apisHuerfanas.length}) — candidatas a código muerto o a uso externo`);
apisHuerfanas.forEach((u) => L.push(`- \`${u}\``));
L.push("");
L.push(`### 4.4 APIs sin validación de sesión visible (${apisSinAuth.length}) — revisar una por una`);
apisSinAuth.forEach((u) => L.push(`- \`${u}\` (${rutas[u].replace("src/app/", "")})`));
L.push("");
L.push(`### 4.5 Funciones SQL (.rpc) usadas por el código`);
Object.entries(rpcUsados).forEach(([r, fs2]) => L.push(`- \`${r}\` → ${fs2.join(", ")}`));
L.push("");
L.push(`### 4.6 Páginas "espejo" (comparten ≥55 % de sus tablas)`);
tabla(["Página A", "Página B", "% tablas en común", "Tablas comunes", "APIs comunes"], espejos.slice(0, 40).map((e) => [`\`${e.a}\``, `\`${e.b}\``, e.j + "%", e.tablas.join(", "), e.apisComunes.length]));
L.push(`### 4.7 Archivos que definen su PROPIO mapa de estados/etiquetas (${mapasEstado.length})`);
mapasEstado.forEach((f) => L.push(`- \`${f}\``));
L.push("");
L.push(`### 4.8 Sidebar vs páginas`);
L.push(`- Enlaces del menú sin página: ${sidebarSinPagina.map((h) => "`" + h + "`").join(", ") || "ninguno"}`);
L.push(`- Páginas de /dashboard sin enlace en el menú: ${paginasSinSidebar.map((h) => "`" + h + "`").join(", ") || "ninguna"}`);
L.push("");
L.push(`### 4.9 Archivos gigantes (> 900 líneas)`);
gigantes.forEach(([f, n]) => L.push(`- \`${f}\` — ${n} líneas`));
L.push("");
fs.writeFileSync(path.join(OUT_DIR, "D-grafo-codigo.md"), L.join("\n"));
console.log(`OK: ${Object.keys(rutas).length} APIs, ${Object.keys(paginas).length} páginas, ${TABLAS.size} tablas. Informe: .claude/mapa/D-grafo-codigo.md`);
