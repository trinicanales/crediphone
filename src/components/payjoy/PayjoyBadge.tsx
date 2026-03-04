/**
 * FASE 20: Badge de Payjoy
 * Muestra scoring/estado de un cliente respecto a Payjoy
 */

"use client";

import { cn } from "@/lib/utils";
import { Zap, AlertTriangle, CheckCircle2, Shield } from "lucide-react";

interface PayjoyBadgeProps {
    hasActiveCredit?: boolean;
    creditScore?: number;
    className?: string;
    showScore?: boolean;
}

export default function PayjoyBadge({
    hasActiveCredit,
    creditScore,
    className,
    showScore = true,
}: PayjoyBadgeProps) {
    if (!hasActiveCredit && !creditScore) {
        return null;
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {/* Badge de crédito activo */}
            {hasActiveCredit && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700">
                    <AlertTriangle className="w-3 h-3" />
                    Crédito Payjoy Activo
                </span>
            )}

            {/* Badge de scoring */}
            {showScore && creditScore !== undefined && (
                <span
                    className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                        creditScore >= 80
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700"
                            : creditScore >= 50
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700"
                                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700"
                    )}
                >
                    {creditScore >= 80 ? (
                        <CheckCircle2 className="w-3 h-3" />
                    ) : creditScore >= 50 ? (
                        <Shield className="w-3 h-3" />
                    ) : (
                        <AlertTriangle className="w-3 h-3" />
                    )}
                    Score: {creditScore}
                </span>
            )}

            {/* Icono de Payjoy */}
            <Zap className="w-4 h-4 text-yellow-500" />
        </div>
    );
}
