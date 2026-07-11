import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getAuthContext } from "@/lib/authz";
import AdminNav from "./AdminNav";

export const metadata = { title: "Dashboard Admin · BacaAi" };

/**
 * Shared admin shell: guards the whole /admin section to admins only and
 * renders the sidebar. Each menu item is its own page rendered as `children`.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin } = await getAuthContext();
  if (!user || !isAdmin) notFound();

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          <aside className="lg:w-56 lg:shrink-0">
            <div className="lg:sticky lg:top-20">
              <h1 className="text-lg font-extrabold tracking-tight">
                Dashboard
              </h1>
              <p className="text-xs text-muted">Kelola BacaAi</p>
              <div className="mt-4">
                <AdminNav />
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </>
  );
}
