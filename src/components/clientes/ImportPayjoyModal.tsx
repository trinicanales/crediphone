/**
 * FASE 20: Modal para importar cliente desde Payjoy
 * Permite buscar por teléfono/ID y pre-llenar el formulario de cliente
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
    X,
    Search,
    Loader2,
    UserPlus,
    Phone,
    Hash,
    Zap,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";

interface ImportPayjoyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (clienteData: any) => void;
}

export default function ImportPayjoyModal({
    isOpen,
    onClose,
    onImport,
}: ImportPayjoyModalProps) {
    const [searchType, setSearchType] = useState<"phone" | "id">("phone");
    const [searchValue, setSearchValue] = useState("");
    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!searchValue.trim()) return;

        setSearching(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch("/api/payjoy/import-customer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    searchType === "phone"
                        ? { phoneNumber: searchValue }
                        : { customerId: searchValue }
                ),
            });

            const data = await response.json();

            if (data.success) {
                setResult(data.data);
            } else {
                setError(data.message || data.error || "Cliente no encontrado");
            }
        } catch {
            setError("Error al buscar en Payjoy");
        } finally {
            setSearching(false);
        }
    };

    const handleImport = () => {
        if (result) {
            onImport(result);
            handleReset();
            onClose();
        }
    };

    const handleReset = () => {
        setSearchValue("");
        setResult(null);
        setError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                            <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Importar desde Payjoy
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Buscar cliente en la plataforma Payjoy
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Search Type */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setSearchType("phone");
                                handleReset();
                            }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                searchType === "phone"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                        >
                            <Phone className="w-4 h-4" />
                            Por Teléfono
                        </button>
                        <button
                            onClick={() => {
                                setSearchType("id");
                                handleReset();
                            }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                searchType === "id"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                        >
                            <Hash className="w-4 h-4" />
                            Por ID de Payjoy
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="flex gap-2">
                        <Input
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder={
                                searchType === "phone"
                                    ? "Ej: 618 123 4567"
                                    : "Ej: PJ-CUST-12345"
                            }
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={searching || !searchValue.trim()}
                        >
                            {searching ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Search className="w-4 h-4" />
                            )}
                        </Button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-sm">{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <Card className="p-4 border-2 border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <span className="font-medium text-green-800 dark:text-green-200 text-sm">
                                    Cliente encontrado en Payjoy
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">
                                            Nombre:
                                        </span>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {result.nombre} {result.apellido}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">
                                            Teléfono:
                                        </span>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {result.telefono || "N/A"}
                                        </p>
                                    </div>
                                    {result.email && (
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">
                                                Email:
                                            </span>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {result.email}
                                            </p>
                                        </div>
                                    )}
                                    {result.payjoyCreditScore !== undefined && (
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">
                                                Score:
                                            </span>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {result.payjoyCreditScore}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {result.payjoyHasActiveCredit && (
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="text-sm font-medium">
                                                Este cliente tiene un crédito Payjoy activo
                                            </span>
                                        </div>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                            No se le puede otorgar un crédito CREDIPHONE mientras tenga
                                            crédito activo en Payjoy
                                        </p>
                                    </div>
                                )}

                                {/* Órdenes activas */}
                                {result.payjoyActiveOrders &&
                                    result.payjoyActiveOrders.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                                Órdenes de Financiamiento Activas:
                                            </p>
                                            {result.payjoyActiveOrders.map(
                                                (order: any, index: number) => (
                                                    <div
                                                        key={index}
                                                        className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded mb-1"
                                                    >
                                                        <span className="font-medium">
                                                            {order.financeOrderId}
                                                        </span>
                                                        {order.deviceModel && (
                                                            <span className="text-gray-500 ml-2">
                                                                — {order.deviceModel}
                                                            </span>
                                                        )}
                                                        {order.remainingBalance !== undefined && (
                                                            <span className="text-gray-500 ml-2">
                                                                Saldo: $
                                                                {order.remainingBalance.toLocaleString("es-MX")}
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                            </div>

                            <div className="mt-4">
                                <Button onClick={handleImport} className="w-full">
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Importar Datos al Formulario
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
