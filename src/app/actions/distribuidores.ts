"use server";

import { createDistribuidor, updateDistribuidor } from "@/lib/db/distribuidores";
import { type Distribuidor } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createDistribuidorAction(formData: FormData) {
    const nombre = formData.get("nombre") as string;
    const slug = formData.get("slug") as string;
    const logoUrl = formData.get("logoUrl") as string || undefined;
    const activo = formData.get("activo") === "on";

    try {
        const newDist = await createDistribuidor({
            nombre,
            slug,
            logoUrl,
            activo,
            configuracion: {}, // Default config created by createDistribuidor helper
        });

        revalidatePath("/dashboard/admin/distribuidores");
    } catch (error: any) {
        return { error: error.message };
    }

    redirect("/dashboard/admin/distribuidores");
}

export async function updateDistribuidorAction(id: string, formData: FormData) {
    const nombre = formData.get("nombre") as string;
    const slug = formData.get("slug") as string;
    const logoUrl = formData.get("logoUrl") as string || undefined;
    const activo = formData.get("activo") === "on";

    try {
        await updateDistribuidor(id, {
            nombre,
            slug,
            logoUrl,
            activo,
        });

        revalidatePath("/dashboard/admin/distribuidores");
        revalidatePath(`/dashboard/admin/distribuidores/${id}`);
    } catch (error: any) {
        return { error: error.message };
    }

    redirect("/dashboard/admin/distribuidores");
}
