// Hook "Stop": antes de dar la tarea por terminada, corre el chequeo de tipos (tsc) SOLO si hay
// cambios sin confirmar en src/. Si hay errores, bloquea el cierre y los devuelve a Claude.
// (Autorizado por Trini 2026-11-07. Para desactivar: quitar el hook Stop de .claude/settings.json)
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let entrada = {};
try { entrada = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { /* sin stdin */ }
if (entrada.stop_hook_active) process.exit(0); // evita bucles: si ya se pidió corregir, no insistir

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = spawnSync("git", ["status", "--porcelain", "--", "src"], { cwd: raiz, encoding: "utf8" });
const hayCambios = (git.stdout || "").split("\n").some((l) => /\.(ts|tsx)\s*$/.test(l.trim()));
if (!hayCambios) process.exit(0); // nada pendiente en src/: no gastar tiempo

function buscarTsc(desde) {
  let d = desde;
  for (let i = 0; i < 6; i++) {
    const p = path.join(d, "node_modules", "typescript", "bin", "tsc");
    if (fs.existsSync(p)) return p;
    d = path.dirname(d);
  }
  return null;
}
const tsc = buscarTsc(raiz);
if (!tsc) {
  console.log(JSON.stringify({ systemMessage: "Verificación de tipos omitida: no se encontró TypeScript (node_modules)." }));
  process.exit(0);
}

const r = spawnSync(process.execPath, [tsc, "--noEmit"], { cwd: raiz, encoding: "utf8", timeout: 280000, maxBuffer: 20 * 1024 * 1024 });
const salida = ((r.stdout || "") + (r.stderr || "")).trim();
if (r.status === 0) process.exit(0);

const lineas = salida.split("\n").filter((l) => /error TS/.test(l));
const resumen = lineas.slice(0, 20).join("\n") || salida.slice(0, 2000);
console.log(JSON.stringify({
  decision: "block",
  reason: `El chequeo de tipos (tsc --noEmit) encontró ${lineas.length || "algunos"} error(es). Corrígelos antes de terminar:\n${resumen}`,
}));
process.exit(0);
