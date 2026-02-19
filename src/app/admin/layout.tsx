import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminLayoutPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <AdminLayout>{children}</AdminLayout>
      <Toaster richColors position="top-right" />
    </>
  );
}
