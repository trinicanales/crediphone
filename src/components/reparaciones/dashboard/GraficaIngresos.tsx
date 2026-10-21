"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { Card } from "@/components/ui/Card";
import type { IngresoMes } from "@/lib/db/reparaciones-dashboard";
import { formatMXN as formatCurrency } from "@/lib/format";

interface GraficaIngresosProps {
  data: IngresoMes[];
}

export function GraficaIngresos({ data }: GraficaIngresosProps) {
  if (!data || data.length === 0) {
    return (
      <Card title="💰 Tendencia de Ingresos">
        <div className="h-64 flex items-center justify-center text-gray-500">
          No hay datos disponibles
        </div>
      </Card>
    );
  }

  return (
    <Card title="💰 Tendencia de Ingresos">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="nombreMes"
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: any, name: any) => {
                if (name === "Ingresos" && value !== undefined) {
                  return [formatCurrency(value), name];
                }
                return [value || 0, name || ""];
              }}
            />
            <Legend />
            <Bar
              yAxisId="right"
              dataKey="ordenesCompletadas"
              name="Órdenes"
              fill="#94A3B8"
              opacity={0.5}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="ingresos"
              name="Ingresos"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: "#10B981", r: 5 }}
              activeDot={{ r: 7 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
