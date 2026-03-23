/**
 * CREDIPHONE — Cola de operaciones offline
 *
 * Almacena transacciones pendientes en IndexedDB cuando no hay internet.
 * El sync las envía al servidor cuando se recupera la conexión.
 */

const DB_NAME = "crediphone_offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_ops";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type OperacionTipo = "venta" | "reparacion_estado";

export interface PendingOperation {
  id?: number;
  tipo: OperacionTipo;
  payload: unknown;
  creadaEn: number;   // timestamp ms
  intentos: number;
  ultimoError?: string;
}

export interface ResultadoSync {
  procesadas: number;
  fallidas: number;
  errores: { id: number; error: string }[];
}

// ── Helpers DB ────────────────────────────────────────────────────────────────

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("creadaEn", "creadaEn");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Agrega una operación a la cola local */
export async function encolarOperacion(
  op: Pick<PendingOperation, "tipo" | "payload">
): Promise<number> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).add({
      tipo: op.tipo,
      payload: op.payload,
      creadaEn: Date.now(),
      intentos: 0,
    } satisfies Omit<PendingOperation, "id">);
    req.onsuccess = () => resolve(req.result as number);
    tx.onerror = () => reject(tx.error);
  });
}

/** Lee todas las operaciones pendientes (orden FIFO) */
export async function leerPendientes(): Promise<PendingOperation[]> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as PendingOperation[]).sort((a, b) => a.creadaEn - b.creadaEn)
      );
    req.onerror = () => reject(req.error);
  });
}

/** Cuenta las operaciones pendientes */
export async function contarPendientes(): Promise<number> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Elimina una operación completada */
export async function eliminarOperacion(id: number): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Actualiza el contador de intentos y guarda el error */
export async function marcarIntento(id: number, error: string): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const op = getReq.result as PendingOperation;
      if (op) {
        op.intentos += 1;
        op.ultimoError = error;
        store.put(op);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
