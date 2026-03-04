"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { createDistribuidorAction, updateDistribuidorAction } from "@/app/actions/distribuidores";
import type { Distribuidor } from "@/types";

interface DistribuidorFormProps {
    initialData?: Distribuidor;
    isEdit?: boolean;
}

export default function DistribuidorForm({ initialData, isEdit = false }: DistribuidorFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError(null);

        let result;
        if (isEdit && initialData) {
            result = await updateDistribuidorAction(initialData.id, formData);
        } else {
            result = await createDistribuidorAction(formData);
        }

        if (result && result.error) {
            setError(result.error);
            setLoading(false);
        }
        // Si no hay error, la acción redirige automáticamente
    }

    return (
        <Card className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                {isEdit ? "Editar Distribuidor" : "Nuevo Distribuidor"}
            </h2>

            <form action={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre de la Empresa *
                    </label>
                    <Input
                        id="nombre"
                        name="nombre"
                        defaultValue={initialData?.nombre}
                        required
                        placeholder="Ej: CrediPhone Centro"
                    />
                </div>

                <div>
                    <label htmlFor="slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Slug (Identificador único) *
                    </label>
                    <Input
                        id="slug"
                        name="slug"
                        defaultValue={initialData?.slug}
                        required
                        placeholder="Ej: centro"
                        pattern="[a-z0-9-]+"
                        title="Solo letras minúsculas, números y guiones"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Usado para URLs y referencias internas. Solo minúsculas y guiones.
                    </p>
                </div>

                <div>
                    <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        URL del Logo (Opcional)
                    </label>
                    <Input
                        id="logoUrl"
                        name="logoUrl"
                        defaultValue={initialData?.logoUrl}
                        placeholder="https://..."
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="activo"
                        name="activo"
                        defaultChecked={initialData?.activo ?? true}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="activo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Distribuidor Activo
                    </label>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button type="button" variant="secondary" onClick={() => window.history.back()}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Distribuidor"}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
