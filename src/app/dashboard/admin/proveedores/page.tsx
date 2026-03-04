import Link from "next/link";
import { getProveedores } from "@/lib/db/proveedores";
import { getDistribuidorId } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Truck, Edit, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export default async function ProveedoresPage() {
    let distribuidorId = await getDistribuidorId();

    // Fallback for super_admin
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

    const proveedores = await getProveedores(distribuidorId);

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Truck className="w-8 h-8" /> Proveedores
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Gestión de proveedores para control de compras e inventario.
                    </p>
                </div>
                <Link href="/dashboard/admin/proveedores/nuevo">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Proveedor
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {proveedores.map((prov) => (
                    <Card key={prov.id} className="hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                <Truck className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                        </div>

                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {prov.nombre}
                        </h3>

                        <div className="space-y-2 mb-4">
                            {prov.contacto && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-semibold">Contacto:</span> {prov.contacto}
                                </p>
                            )}
                            {prov.telefono && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Phone className="w-3 h-3" /> {prov.telefono}
                                </div>
                            )}
                            {prov.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Mail className="w-3 h-3" /> {prov.email}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 flex justify-end gap-2">
                            <Link href={`/dashboard/admin/proveedores/${prov.id}`}>
                                <Button variant="ghost" size="sm">
                                    <Edit className="w-4 h-4 mr-1" /> Editar
                                </Button>
                            </Link>
                        </div>
                    </Card>
                ))}

                {proveedores.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <Truck className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay proveedores</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Registra a tus proveedores para asignar productos y compras.</p>
                        <Link href="/dashboard/admin/proveedores/nuevo">
                            <Button variant="secondary">
                                <Plus className="w-4 h-4 mr-2" />
                                Crear Primer Proveedor
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
