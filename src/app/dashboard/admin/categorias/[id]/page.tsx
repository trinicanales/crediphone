import { getCategoriaById } from "@/lib/db/categorias";
import CategoriaForm from "@/components/admin/CategoriaForm";
import { notFound } from "next/navigation";

export default async function EditCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const categoria = await getCategoriaById(id);

  if (!categoria) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <CategoriaForm initialData={categoria} isEdit={true} />
    </div>
  );
}
