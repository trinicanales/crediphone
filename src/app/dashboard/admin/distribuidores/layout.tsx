import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/server";

export default async function DistribuidoresLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId, role } = await getAuthContext();

    if (!userId) {
        redirect("/auth/login");
    }

    if (role !== "super_admin") {
        redirect("/dashboard");
    }

    return <>{children}</>;
}
