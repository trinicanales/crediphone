import Link from "next/link";
import { getCategorias } from "@/lib/db/categorias";
import { getDistribuidorId } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Tag, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export default async function CategoriasPage() {
    let distribuidorId = await getDistribuidorId();

    // Fallback for super_admin without distribuidor_id (e.g. newly created)
    if (!distribuidorId) {
        const adminClient = createAdminClient();
        const { data: defaultDist } = await adminClient
            .from("distribuidores")
            .select("id")
            .eq("slug", "default")
            .single();
        if (defaultDist) {
            distribuidorId = defaultDist.id;
        }
    }

    if (!distribuidorId) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600">Error: No se encontró distribuidor activo.</h1>
                <p>Por favor contacta a soporte.</p>
            </div>
        );
    }

    const categorias = await getCategorias(distribuidorId);

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Tag className="w-8 h-8" /> Categorías
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Gestión de categorías de productos para el inventario.
                    </p>
                </div>
                <Link href="/dashboard/admin/categorias/nueva">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Categoría
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categorias.map((cat) => (
                    <Card key={cat.id} className="hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <Tag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </div>

                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {cat.nombre}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                            {cat.descripcion || "Sin descripción"}
                        </p>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 flex justify-end gap-2">
                            <Link href={`/dashboard/admin/categorias/${cat.id}`}>
                                <Button variant="ghost" size="sm">
                                    <Edit className="w-4 h-4 mr-1" /> Editar
                                </Button>
                            </Link>
                        </div>
                    </Card>
                ))}

                {categorias.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <Tag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay categorías</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Comienza creando una nueva categoría para organizar tus productos.</p>
                        <Link href="/dashboard/admin/categorias/nueva">
                            <Button variant="secondary">
                                <Plus className="w-4 h-4 mr-2" />
                                Crear Primera Categoría
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
