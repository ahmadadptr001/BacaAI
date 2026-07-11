import { getAuthContext } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import UserActions from "../UserActions";
import { CheckIcon } from "@/components/icons";

export const metadata = { title: "Pengguna · BacaAi" };

interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  verified: boolean;
  role: "user" | "admin";
}

export default async function AdminUsersPage() {
  const { user } = await getAuthContext();
  const admin = createAdminClient();

  const { data: profiles } = await admin.from("profiles").select("id, role");
  const roleById = new Map(
    (profiles ?? []).map((p: { id: string; role: string }) => [p.id, p.role])
  );

  const { data: usersData } = await admin.auth.admin.listUsers();
  const users: AdminUserRow[] = (usersData?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "(tanpa email)",
    created_at: u.created_at,
    verified: !!u.email_confirmed_at,
    role: (roleById.get(u.id) as "user" | "admin") ?? "user",
  }));

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">
        Pengguna <span className="text-muted">({users.length})</span>
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-card text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border bg-card/40">
                <td className="px-4 py-3">
                  {u.email}
                  {u.id === user?.id && (
                    <span className="ml-2 text-xs text-muted">(kamu)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.verified ? (
                    <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400">
                      <CheckIcon className="h-3.5 w-3.5" />
                      Terverifikasi
                    </span>
                  ) : (
                    <span className="text-muted">Belum</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.role === "admin"
                        ? "bg-brand-600 text-white"
                        : "bg-brand-50 text-muted dark:bg-brand-600/15"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <UserActions
                    userId={u.id}
                    role={u.role}
                    isSelf={u.id === user?.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
