"use client";

import { useState, useEffect } from "react";
import { generarDeslindesInteligentes } from "@/lib/deslindes-legales";
import { CondicionesFuncionamiento, EstadoFisicoDispositivo } from "@/types";

interface ComponenteDeslindesProps {
  problemaReportado: string;
  condiciones: CondicionesFuncionamiento;
  estadoFisico: EstadoFisicoDispositivo;
  deslindesCustom: string[];
  onChange: (nuevosDeslindes: string[]) => void;
}

export function ComponenteDeslindes({
  problemaReportado,
  condiciones,
  estadoFisico,
  deslindesCustom,
  onChange,
}: ComponenteDeslindesProps) {
  const [mostrarTodos, setMostrarTodos] = useState(false);

  // Auto-generar deslindes cuando cambia el problema, condiciones o estado físico
  useEffect(() => {
    // Solo auto-generar si el array está vacío
    if (deslindesCustom.length === 0 && problemaReportado.trim().length > 0) {
      const autogenerados = generarDeslindesInteligentes(
        problemaReportado,
        condiciones,
        estadoFisico
      );
      onChange(autogenerados);
    }
  }, [problemaReportado, condiciones, estadoFisico]);

  const regenerar = () => {
    if (problemaReportado.trim().length === 0) {
      alert(
        "Por favor, describe el problema reportado para generar deslindes relevantes."
      );
      return;
    }

    const autogenerados = generarDeslindesInteligentes(
      problemaReportado,
      condiciones,
      estadoFisico
    );
    onChange(autogenerados);
  };

  const agregarDeslinde = () => {
    onChange([...deslindesCustom, "Nuevo deslinde personalizado..."]);
  };

  const editarDeslinde = (index: number, texto: string) => {
    const nuevos = [...deslindesCustom];
    nuevos[index] = texto;
    onChange(nuevos);
  };

  const eliminarDeslinde = (index: number) => {
    if (
      confirm(
        "¿Estás seguro de eliminar este deslinde? Esta acción no se puede deshacer."
      )
    ) {
      onChange(deslindesCustom.filter((_, i) => i !== index));
    }
  };

  const deslindesToShow = mostrarTodos
    ? deslindesCustom
    : deslindesCustom.slice(0, 2);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span>⚖️</span>
          <span>Deslindes Legales</span>
          <span className="text-xs font-normal text-gray-500">
            ({deslindesCustom.length} aplicables)
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={regenerar}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            🔄 Regenerar
          </button>
          <button
            type="button"
            onClick={agregarDeslinde}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            + Agregar
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
        <strong>ℹ️ Inteligencia automática:</strong> Los deslindes se generan
        según el <strong>problema reportado</strong> y las{" "}
        <strong>condiciones marcadas</strong>. Puedes editarlos o agregar nuevos
        manualmente.
      </div>

      {deslindesCustom.length === 0 ? (
        <div className="text-xs text-gray-500 text-center italic py-8 border border-gray-200 rounded-lg bg-gray-50">
          <div className="mb-2 text-2xl">📝</div>
          <p>No hay deslindes generados todavía.</p>
          <p className="mt-1">
            Completa el <strong>&quot;Problema Reportado&quot;</strong> y marca las
            condiciones del dispositivo para generarlos automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {deslindesToShow.map((deslinde, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 bg-white hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold text-gray-700">
                  Deslinde {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => eliminarDeslinde(index)}
                  className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
                  title="Eliminar deslinde"
                >
                  ✕ Eliminar
                </button>
              </div>
              <textarea
                value={deslinde}
                onChange={(e) => editarDeslinde(index, e.target.value)}
                className="w-full text-xs p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Texto del deslinde legal..."
              />
            </div>
          ))}

          {deslindesCustom.length > 2 && (
            <button
              type="button"
              onClick={() => setMostrarTodos(!mostrarTodos)}
              className="w-full text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-2 rounded transition-colors font-medium"
            >
              {mostrarTodos
                ? `▲ Mostrar menos`
                : `▼ Mostrar todos (${deslindesCustom.length - 2} más)`}
              </button>
          )}
        </div>
      )}

      {deslindesCustom.length > 0 && (
        <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
          💡 <strong>Tip:</strong> Los deslindes protegen legalmente al negocio.
          Asegúrate de que sean claros y específicos para la reparación.
        </div>
      )}
    </div>
  );
}
