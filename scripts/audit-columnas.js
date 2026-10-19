// Auditoría: columnas que el código usa y NO existen en la BD. Uso: node scripts/audit-columnas.js (desde la raíz del repo).
// scripts/audit-schema.json es una FOTO del esquema (2026-10-19): regenerar con la consulta de information_schema.columns antes de reutilizar.
// Los resultados cuyo "campo" es un nombre de tabla son relaciones embebidas (falsos positivos).
const fs = require('fs'), path = require('path');
const S = __dirname + '/';
const schemaRaw = JSON.parse(fs.readFileSync(S + 'audit-schema.json', 'utf8'));
const schema = {};
for (const k of Object.keys(schemaRaw)) schema[k] = new Set(schemaRaw[k].split(','));
const BS = String.fromCharCode(92);
function walk(d, o = []) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p, o) : o.push(p); } return o; }
const files = walk('src').map((f) => f.split(BS).join('/')).filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('src/types'));

function topLevelKeys(str, start) {
  // str[start] === '{'  → devuelve claves de primer nivel de ese literal
  let depth = 0, i = start, keys = [], buf = '';
  let inStr = null;
  for (; i < str.length; i++) {
    const ch = str[i];
    if (inStr) { if (ch === inStr && str[i - 1] !== BS) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{' || ch === '(' || ch === '[') { depth++; if (depth === 1) { buf = ''; continue; } }
    else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) break; }
    if (depth === 1) {
      if (ch === ',' ) { const m = buf.match(/^\s*([a-z][a-z0-9_]*)\s*(:|$)/); if (m) keys.push(m[1]); buf = ''; }
      else buf += ch;
    }
  }
  const m = buf.match(/^\s*([a-z][a-z0-9_]*)\s*(:|$)/); if (m) keys.push(m[1]);
  return keys;
}
function selectCols(sel) {
  // quitar relaciones embebidas alias:tabla(...)
  let out = '', depth = 0;
  for (const ch of sel) { if (ch === '(') depth++; else if (ch === ')') depth--; else if (depth === 0) out += ch; }
  return out.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^[a-z_]+:/, '').replace(/!.*$/, '')).filter((s) => /^[a-z][a-z0-9_]*$/.test(s));
}
const problems = {};
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const re = /\.from\(\s*["']([a-z_0-9]+)["']\s*\)/g;
  let m;
  while ((m = re.exec(t))) {
    const table = m[1];
    if (!schema[table]) continue;
    const rest = t.slice(m.index + m[0].length, m.index + m[0].length + 2500);
    let end = rest.search(/;\s*\n|\.from\(/);
    if (end < 0) end = rest.length;
    const chain = rest.slice(0, end);
    const cols = new Set();
    let mm;
    const selRe = /\.select\(\s*([`"'])([\s\S]*?)\1/g;
    while ((mm = selRe.exec(chain))) if (mm[2].trim() !== '*') selectCols(mm[2]).forEach((c) => cols.add(c));
    const fnRe = /\.(?:eq|neq|in|gte|gt|lte|lt|is|not|ilike|like|order|contains|overlaps)\(\s*["']([a-z][a-z0-9_]*)["']/g;
    while ((mm = fnRe.exec(chain))) cols.add(mm[1]);
    const wrRe = /\.(?:insert|update|upsert)\(\s*(\[?\s*)\{/g;
    while ((mm = wrRe.exec(chain))) { const b = chain.indexOf('{', mm.index); topLevelKeys(chain, b).forEach((c) => cols.add(c)); }
    for (const c of cols) {
      if (!schema[table].has(c)) {
        const line = t.slice(0, m.index).split('\n').length;
        const key = table + '.' + c;
        (problems[key] = problems[key] || []).push(f + ':' + line);
      }
    }
  }
}
for (const k of Object.keys(problems).sort()) console.log(k.padEnd(48), [...new Set(problems[k])].slice(0, 3).join('  '));
console.log('--- posibles columnas inexistentes:', Object.keys(problems).length);
