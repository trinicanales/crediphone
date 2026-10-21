"use client";

/**
 * FASE 20: Reporte de Comisiones por Vendedor
 * Comisión individual por empleado configurada en la página de Empleados.
 * Si comision_porcentaje = 0 → sin comisión (deshabilitado).
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { DollarSign, Users, ShoppingBag, CreditCard, Download, Loader2, Info } from "lucide-react";
import { formatMXNDec as formatMXN } from "@/lib/format";

interface ComisionVendedor {
    vendedorId: string;
    vendedorNombre: string;
    vendedorRol: string;
    comisionPorcentaje: number;
    comisionHabilitada: boolean;
    ventasPOS: number;
    creditosNuevos: number;
    totalEquipos: number;
    totalVentasPOS: number;
    totalCreditos: number;
    totalMonto: number;
    comision: number;
}

interface ReporteComisiones {
    fecha: string;
    totalComisiones: number;
    data: ComisionVendedor[];
}

export default function ComisionesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
    const [loading, setLoading] = useState(false);
    const [reporte, setReporte] = useState<ReporteComisiones | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user && user.role !== "admin" && user.role !== "super_admin") {
            router.push("/dashboard");
        }
    }, [user, router]);

    const fetchReporte = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/reportes/comisiones?fecha=${fecha}`);
            const data = await res.json();
            if (data.success) {
                setReporte(data);
            } else {
                setError(data.error || "Error al cargar reporte");
            }
        } catch {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReporte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExportCSV = () => {
        if (!reporte) return;
        const headers = ["Vendedor", "Rol", "% Comisión", "Habilitado", "Ventas POS", "Créditos", "Equipos", "Monto Ventas", "Monto Créditos", "Total", "Comisión"];
        const rows = reporte.data.map((r) => [
            r.vendedorNombre,
            r.vendedorRol,
            `${r.comisionPorcentaje}%`,
            r.comisionHabilitada ? "Sí" : "No",
            r.ventasPOS,
            r.creditosNuevos,
            r.totalEquipos,
            r.totalVentasPOS.toFixed(2),
            r.totalCreditos.toFixed(2),
            r.totalMonto.toFixed(2),
            r.comision.toFixed(2),
        ]);
        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `comisiones-${fecha}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!user || (user.role !== "admin" && user.role !== "super_admin")) return null;

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Comisiones por Vendedor</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Comisiones calculadas individualmente por empleado — ventas POS y créditos nuevos
                </p>
            </div>

            {/* Info */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-2 text-sm text-blue-800 dark:text-blue-300">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                    El porcentaje de comisión se configura <strong>por empleado</strong> en{" "}
                    <a href="/dashboard/empleados" className="underline font-medium">Empleados → Editar empleado</a>.
                    Si el % es 0, el empleado no recibe comisión.
                </span>
            </div>

            {/* Filtro de fecha */}
            <Card className="mb-6 p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Fecha
                        </label>
                        <Input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                    </div>
                    <Button onClick={fetchReporte} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {loading ? "Cargando..." : "Ver Comisiones"}
                    </Button>
                    {reporte && (
                        <Button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700">
                            <Download className="w-4 h-4 mr-2" />
                            Exportar CSV
                        </Button>
                    )}
                </div>
            </Card>

            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {reporte && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                        <Card>
                            <div className="flex items-center gap-3">
                                <Users className="w-8 h-8 text-blue-500" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Con ventas hoy</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {reporte.data.filter((r) => r.totalEquipos > 0).length}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-3">
                                <ShoppingBag className="w-8 h-8 text-purple-500" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total equipos</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {reporte.data.reduce((s, r) => s + r.totalEquipos, 0)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-3">
                                <CreditCard className="w-8 h-8 text-green-500" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total vendido</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                                        {formatMXN(reporte.data.reduce((s, r) => s + r.totalMonto, 0))}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-3">
                                <DollarSign className="w-8 h-8 text-yellow-500" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total comisiones</p>
                                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                        {formatMXN(reporte.totalComisiones)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Tabla */}
                    <Card>
                        {reporte.data.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                No hay empleados registrados
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Empleado</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">% Comisión</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ventas POS</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Créditos</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Monto POS</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Monto Créditos</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Comisión</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {reporte.data.map((vendedor) => (
                                            <tr
                                                key={vendedor.vendedorId}
                                                className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${!vendedor.comisionHabilitada ? "opacity-60" : ""}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {vendedor.vendedorNombre}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                                        {vendedor.vendedorRol}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {vendedor.comisionHabilitada ? (
                                                        <span className="inline-block px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-sm font-medium">
                                                            {vendedor.comisionPorcentaje}%
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">
                                                            Sin comisión
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                                                    {vendedor.ventasPOS}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                                                    {vendedor.creditosNuevos}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                                                    {formatMXN(vendedor.totalVentasPOS)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                                                    {formatMXN(vendedor.totalCreditos)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                                    {formatMXN(vendedor.totalMonto)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {vendedor.comisionHabilitada ? (
                                                        <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                                            {formatMXN(vendedor.comision)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                                                TOTALES
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                                {reporte.data.reduce((s, r) => s + r.creditosNuevos, 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatMXN(reporte.data.reduce((s, r) => s + r.totalVentasPOS, 0))}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatMXN(reporte.data.reduce((s, r) => s + r.totalCreditos, 0))}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatMXN(reporte.data.reduce((s, r) => s + r.totalMonto, 0))}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                                {formatMXN(reporte.totalComisiones)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}
