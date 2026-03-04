/**
 * FASE 20: Componente de Configuración de Payjoy
 * Sección para configurar la integración con Payjoy desde admin
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { Configuracion } from "@/types";
import {
    Zap,
    Wifi,
    WifiOff,
    Loader2,
    Download,
    Save,
    CheckCircle2,
    XCircle,
    AlertTriangle,
} from "lucide-react";

interface PayjoyConfigSectionProps {
    formData: Partial<Configuracion>;
    onFieldChange: (field: keyof Configuracion, value: any) => void;
    onSave: () => void;
    saving: boolean;
}

export default function PayjoyConfigSection({
    formData,
    onFieldChange,
    onSave,
    saving,
}: PayjoyConfigSectionProps) {
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionResult, setConnectionResult] = useState<{
        connected: boolean;
        message: string;
        latencyMs?: number;
    } | null>(null);
    const [exporting, setExporting] = useState(false);

    const handleTestConnection = async () => {
        setTestingConnection(true);
        setConnectionResult(null);

        try {
            const response = await fetch("/api/payjoy/test-connection", {
                method: "POST",
            });
            const result = await response.json();
            setConnectionResult({
                connected: result.connected,
                message: result.message,
                latencyMs: result.latencyMs,
            });
        } catch {
            setConnectionResult({
                connected: false,
                message: "Error al conectar con la API",
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await fetch("/api/payjoy/export");
            const data = await response.json();

            // Descargar como JSON
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `payjoy-export-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting:", error);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toggle Payjoy */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Integración Payjoy
                    </h3>
                </div>

                <div className="space-y-6">
                    {/* Habilitar/Deshabilitar */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                Habilitar Payjoy
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Activar la integración con la plataforma de financiamiento Payjoy
                            </p>
                        </div>
                        <button
                            onClick={() =>
                                onFieldChange("payjoyEnabled", !formData.payjoyEnabled)
                            }
                            className={cn(
                                "relative inline-flex h-6 w-11 rounded-full transition-colors",
                                formData.payjoyEnabled
                                    ? "bg-yellow-500"
                                    : "bg-gray-300 dark:bg-gray-600"
                            )}
                        >
                            <span
                                className={cn(
                                    "inline-block h-5 w-5 rounded-full bg-white transform transition-transform mt-0.5",
                                    formData.payjoyEnabled
                                        ? "translate-x-5"
                                        : "translate-x-0.5"
                                )}
                            />
                        </button>
                    </div>

                    {/* Auto Sync */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                Sincronización Automática
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Crear pagos automáticamente cuando se reciba un webhook de Payjoy
                            </p>
                        </div>
                        <button
                            onClick={() =>
                                onFieldChange(
                                    "payjoyAutoSyncPayments",
                                    !formData.payjoyAutoSyncPayments
                                )
                            }
                            className={cn(
                                "relative inline-flex h-6 w-11 rounded-full transition-colors",
                                formData.payjoyAutoSyncPayments
                                    ? "bg-blue-600"
                                    : "bg-gray-300 dark:bg-gray-600"
                            )}
                        >
                            <span
                                className={cn(
                                    "inline-block h-5 w-5 rounded-full bg-white transform transition-transform mt-0.5",
                                    formData.payjoyAutoSyncPayments
                                        ? "translate-x-5"
                                        : "translate-x-0.5"
                                )}
                            />
                        </button>
                    </div>

                    {/* Webhook URL (informativa) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            URL del Webhook (proporcionada a Payjoy)
                        </label>
                        <Input
                            value={formData.payjoyWebhookUrl || ""}
                            onChange={(e) =>
                                onFieldChange("payjoyWebhookUrl", e.target.value)
                            }
                            placeholder="https://tu-dominio.com/api/payjoy/webhook"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Esta URL debe registrarse en el panel de Payjoy para recibir
                            notificaciones de pagos
                        </p>
                    </div>
                </div>

                {/* Test Connection */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {formData.payjoyConnectionStatus === "connected" ? (
                                <Wifi className="w-5 h-5 text-green-500" />
                            ) : (
                                <WifiOff className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                    Estado de Conexión
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formData.payjoyConnectionStatus === "connected"
                                        ? "✅ Conectado"
                                        : formData.payjoyConnectionStatus === "error"
                                            ? "❌ Error"
                                            : "⏳ Sin verificar"}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={handleTestConnection}
                            disabled={testingConnection}
                            className="text-sm"
                        >
                            {testingConnection ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Probando...
                                </>
                            ) : (
                                <>
                                    <Wifi className="w-4 h-4 mr-2" />
                                    Probar Conexión
                                </>
                            )}
                        </Button>
                    </div>

                    {connectionResult && (
                        <div
                            className={cn(
                                "mt-3 p-3 rounded-lg text-sm",
                                connectionResult.connected
                                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                                    : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                {connectionResult.connected ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <XCircle className="w-4 h-4" />
                                )}
                                <span>{connectionResult.message}</span>
                                {connectionResult.latencyMs && (
                                    <span className="text-xs opacity-75">
                                        ({connectionResult.latencyMs}ms)
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex gap-3">
                    <Button onClick={onSave} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={exporting}
                        className="bg-gray-600 hover:bg-gray-700"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {exporting ? "Exportando..." : "Exportar Datos"}
                    </Button>
                </div>
            </Card>

            {/* Comisiones Sub-distribuidoras */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Comisiones Sub-Distribuidoras
                    </h3>
                </div>

                <div className="space-y-6">
                    {/* Tipo de comisión */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tipo de Comisión
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="comisionTipo"
                                    value="porcentaje"
                                    checked={formData.comisionTipo === "porcentaje"}
                                    onChange={() => onFieldChange("comisionTipo", "porcentaje")}
                                    className="text-blue-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Porcentaje sobre venta
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="comisionTipo"
                                    value="fijo"
                                    checked={formData.comisionTipo === "fijo"}
                                    onChange={() => onFieldChange("comisionTipo", "fijo")}
                                    className="text-blue-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Monto fijo por equipo
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Monto Fijo por Equipo (MXN)
                            </label>
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                value={formData.comisionMontoFijo || 0}
                                onChange={(e) =>
                                    onFieldChange(
                                        "comisionMontoFijo",
                                        parseFloat(e.target.value) || 0
                                    )
                                }
                                disabled={formData.comisionTipo !== "fijo"}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Ej: $100 por cada equipo vendido
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Porcentaje sobre Venta (%)
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={formData.comisionPorcentajeVenta || 0}
                                onChange={(e) =>
                                    onFieldChange(
                                        "comisionPorcentajeVenta",
                                        parseFloat(e.target.value) || 0
                                    )
                                }
                                disabled={formData.comisionTipo !== "porcentaje"}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Ej: 1% del monto total de la venta
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <Button onClick={onSave} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
