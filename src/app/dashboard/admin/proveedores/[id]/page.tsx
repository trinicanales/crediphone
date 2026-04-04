import { getProveedorById } from "@/lib/db/proveedores";
import ProveedorForm from "@/components/admin/ProveedorForm";
import { notFound } from "next/navigation";

export default async function EditProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proveedor = await getProveedorById(id);

  if (!proveedor) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <ProveedorForm initialData={proveedor} isEdit={true} />
    </div>
  );
}
