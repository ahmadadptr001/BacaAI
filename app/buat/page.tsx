import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AddComicForm from "@/app/admin/AddComicForm";
import { getAuthContext } from "@/lib/authz";
import { PenIcon } from "@/components/icons";

export const metadata = { title: "Buat cerita · BacaAi" };

export default async function CreateStoryPage() {
  const { user } = await getAuthContext();
  if (!user) redirect("/login?redirectTo=/buat");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
          <PenIcon className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          Buat ceritamu sendiri
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tulis judul dan bab pembukanya, atau minta bantuan AI. Pembaca lain
          yang akan menentukan ke mana kisahmu melaju.
        </p>

        <div className="mt-6">
          <AddComicForm submitLabel="Terbitkan cerita" redirectOnSuccess />
        </div>
      </main>
    </>
  );
}
