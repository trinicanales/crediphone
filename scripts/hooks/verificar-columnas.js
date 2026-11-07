// Hook "PostToolUse" (Edit|Write): después de editar un .ts/.tsx de src/, corre el detector de
// columnas inexistentes (scripts/audit-columnas.js) y avisa a Claude si ESE archivo usa columnas
// que no existen en la base. Solo informa; no bloquea. (Autorizado por Trini 2026-11-07)
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let entrada = {};
try { entrada = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { process.exit(0); }
const archivo = (entrada.tool_input && entrada.tool_input.file_path) || (entrada.tool_response && entrada.tool_response.filePath) || "";
if (!archivo) process.exit(0);

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = path.relative(raiz, archivo).split(path.sep).join("/");
if (!/^src\/.*\.(ts|tsx)$/.test(rel) || rel.startsWith("src/types")) process.exit(0);

const script = path.join(raiz, "scripts", "audit-columnas.js");
if (!fs.existsSync(script)) process.exit(0);
const r = spawnSync(process.execPath, [script], { cwd: raiz, encoding: "utf8", timeout: 30000 });
const salida = r.stdout || "";

// Los "campos" que son nombres de tabla son relaciones embebidas (falsos positivos conocidos)
let tablas = new Set();
try { tablas = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(raiz, "scripts", "audit-schema.json"), "utf8")))); } catch { /* sin esquema */ }

const hallazgos = salida
  .split("\n")
  .filter((l) => l.includes(rel))
  .map((l) => l.trim())
  .filter((l) => {
    const campo = (l.split(/\s+/)[0] || "").split(".")[1];
    return campo && !tablas.has(campo);
  });
if (hallazgos.length === 0) process.exit(0);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext:
      `Detector de columnas: ${rel} usa columnas que NO existen en la base (verifica contra Supabase antes de seguir):\n` + hallazgos.slice(0, 10).join("\n"),
  },
}));
process.exit(0);
