import AddComicForm from "../AddComicForm";

export const metadata = { title: "Tambah komik — BacaAi" };

export default function AddComicPage() {
  return (
    <div>
      <h2 className="text-lg font-bold">Tambah komik baru</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Cukup isi judul, sinopsis, cerita awal, dan gambar — AI membuat pilihan
        lanjutannya.
      </p>
      <AddComicForm />
    </div>
  );
}
