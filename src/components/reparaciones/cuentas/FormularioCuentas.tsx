"use client";

import { useState } from "react";
import { CuentaDispositivo } from "@/types";

interface FormularioCuentasProps {
  cuentas: CuentaDispositivo[];
  onChange: (nuevasCuentas: CuentaDispositivo[]) => void;
}

const TIPOS_CUENTA = [
  { value: "Google", label: "Google", icono: "📧" },
  { value: "Apple", label: "Apple ID / iCloud", icono: "🍎" },
  { value: "Samsung", label: "Samsung Account", icono: "📱" },
  { value: "Microsoft", label: "Microsoft", icono: "🪟" },
  { value: "Otra", label: "Otra", icono: "🔐" },
] as const;

export function FormularioCuentas({
  cuentas,
  onChange,
}: FormularioCuentasProps) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState<CuentaDispositivo>({
    tipo: "Google",
    email: "",
    usuario: "",
    password: "",
    notas: "",
  });

  const resetForm = () => {
    setFormData({
      tipo: "Google",
      email: "",
      usuario: "",
      password: "",
      notas: "",
    });
    setMostrarFormulario(false);
    setEditandoIndex(null);
  };

  const agregarCuenta = () => {
    if (!formData.email && !formData.usuario) {
      alert("Por favor ingresa un email o nombre de usuario");
      return;
    }

    if (editandoIndex !== null) {
      // Editar cuenta existente
      const nuevasCuentas = [...cuentas];
      nuevasCuentas[editandoIndex] = formData;
      onChange(nuevasCuentas);
    } else {
      // Agregar nueva cuenta
      onChange([...cuentas, formData]);
    }

    resetForm();
  };

  const editarCuenta = (index: number) => {
    setFormData(cuentas[index]);
    setEditandoIndex(index);
    setMostrarFormulario(true);
  };

  const eliminarCuenta = (index: number) => {
    if (confirm("¿Eliminar esta cuenta?")) {
      onChange(cuentas.filter((_, i) => i !== index));
    }
  };

  const obtenerIconoTipo = (tipo: CuentaDispositivo["tipo"]) => {
    return TIPOS_CUENTA.find((t) => t.value === tipo)?.icono || "🔐";
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
          <span>👤</span>
          <span>Cuentas del Dispositivo</span>
          <span className="text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
            ({cuentas.length})
          </span>
        </h3>
        {!mostrarFormulario && (
          <button
            type="button"
            onClick={() => setMostrarFormulario(true)}
            className="text-xs text-white px-3 py-1.5 rounded transition-colors"
            style={{ background: "var(--color-accent)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--color-accent-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--color-accent)")}
          >
            + Agregar Cuenta
          </button>
        )}
      </div>

      {cuentas.length === 0 && !mostrarFormulario && (
        <div className="text-xs text-center italic py-8 rounded-lg" style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
          <div className="mb-2 text-2xl">🔐</div>
          <p>No hay cuentas registradas.</p>
          <p className="mt-1">
            Agrega las cuentas de Google, Apple, Samsung, etc. asociadas al
            dispositivo.
          </p>
        </div>
      )}

      {/* Lista de cuentas existentes */}
      {cuentas.length > 0 && (
        <div className="space-y-2">
          {cuentas.map((cuenta, index) => (
            <div
              key={index}
              className="rounded-lg p-3 transition-colors"
              style={{ border: "1px solid var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{obtenerIconoTipo(cuenta.tipo)}</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {cuenta.tipo}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => editarCuenta(index)}
                    className="text-xs px-2 py-0.5 rounded transition-colors"
                    style={{ color: "var(--color-accent)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-accent-light)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarCuenta(index)}
                    className="text-xs px-2 py-0.5 rounded transition-colors"
                    style={{ color: "var(--color-danger)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-danger-bg)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    ✕ Eliminar
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1" style={{ color: "var(--color-text-secondary)" }}>
                {cuenta.email && (
                  <div>
                    <strong>Email:</strong> {cuenta.email}
                  </div>
                )}
                {cuenta.usuario && (
                  <div>
                    <strong>Usuario:</strong> {cuenta.usuario}
                  </div>
                )}
                {cuenta.password && (
                  <div className="flex items-center gap-2">
                    <strong>Password:</strong>
                    <code className="px-2 py-0.5 rounded font-mono" style={{ background: "var(--color-bg-elevated)" }}>
                      {"•".repeat(cuenta.password.length)}
                    </code>
                  </div>
                )}
                {cuenta.notas && (
                  <div className="mt-1 italic" style={{ color: "var(--color-text-muted)" }}>
                    <strong>Notas:</strong> {cuenta.notas}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de agregar/editar */}
      {mostrarFormulario && (
        <div className="rounded-lg p-4 space-y-3" style={{ border: "2px solid var(--color-accent)", background: "var(--color-accent-light)" }}>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {editandoIndex !== null ? "Editar Cuenta" : "Nueva Cuenta"}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-secondary)")}
            >
              ✕ Cancelar
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Tipo de cuenta
            </label>
            <select
              value={formData.tipo}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tipo: e.target.value as CuentaDispositivo["tipo"],
                })
              }
              className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
            >
              {TIPOS_CUENTA.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.icono} {tipo.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Email o correo electrónico
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="usuario@ejemplo.com"
              className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Nombre de usuario (opcional)
            </label>
            <input
              type="text"
              value={formData.usuario}
              onChange={(e) =>
                setFormData({ ...formData, usuario: e.target.value })
              }
              placeholder="@username o ID"
              className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Contraseña (opcional)
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Contraseña"
              className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none font-mono"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              ⚠️ La contraseña se guarda en texto plano. Solo visible para personal
              autorizado.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Notas adicionales (opcional)
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) =>
                setFormData({ ...formData, notas: e.target.value })
              }
              placeholder="Ej: Verificación en 2 pasos activa, PIN de pantalla bloqueada, etc."
              rows={2}
              className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none resize-none"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
            />
          </div>

          <button
            type="button"
            onClick={agregarCuenta}
            className="w-full text-white py-2 rounded-lg transition-colors text-sm font-medium"
            style={{ background: "var(--color-accent)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--color-accent-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--color-accent)")}
          >
            {editandoIndex !== null ? "Guardar Cambios" : "Agregar Cuenta"}
          </button>
        </div>
      )}

      {cuentas.length > 0 && (
        <div className="text-xs rounded p-2" style={{ color: "var(--color-text-secondary)", background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
          🔒 <strong>Seguridad:</strong> Las cuentas se guardan encriptadas en la
          base de datos y solo son visibles para personal autorizado.
        </div>
      )}
    </div>
  );
}
