-- ============================================================================
-- Data awal — beberapa komik pembuka dengan bab 1 + titik keputusan.
-- Jalankan SETELAH schema.sql. Aman diulang (UUID stabil + upsert).
-- Gambar placeholder memakai picsum.photos agar UI ada yang ditampilkan.
-- ============================================================================

-- ---- Komik 1: "Jurang Neon" -----------------------------------------------
insert into public.comics (id, title, description, cover_image_url) values
  ('11111111-1111-1111-1111-111111111111',
   'Jurang Neon',
   'Seorang kurir pemula di kota metropolis yang basah oleh hujan tak sengaja menemukan rahasia yang bisa meruntuhkan para korporat. Setiap pengantaran adalah sebuah pilihan.',
   'https://picsum.photos/seed/neon-cover/600/800')
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      cover_image_url = excluded.cover_image_url;

insert into public.chapters (id, comic_id, chapter_number, title, content_text, image_urls) values
  ('aaaaaaaa-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   1,
   'Bab 1 — Paket Itu',
   'Hujan menghantam gang-gang berlampu neon di Distrik 9 saat kamu melajukan motormu di antara lalu lintas. Pad pengantaranmu bergetar: sebuah paket tanpa nama, tanpa pengirim, dengan bayaran tiga kali lipat. Ketika kamu tiba di titik antar, seorang asing bermantel abu-abu menghadang jalanmu. "Paket itu," katanya, "bukan seperti yang kamu kira." Di belakangmu, sebuah drone korporat berdengung mendekat, mata merahnya memindai kerumunan.',
   '["https://picsum.photos/seed/neon-1a/800/450", "https://picsum.photos/seed/neon-1b/800/450"]'::jsonb)
on conflict (id) do update
  set title = excluded.title, content_text = excluded.content_text, image_urls = excluded.image_urls;

insert into public.choices (id, chapter_id, description, sort_order) values
  ('c1c1c1c1-1111-1111-1111-111111111111',
   'aaaaaaaa-1111-1111-1111-111111111111',
   'Ikuti orang asing misterius itu ke dalam gang', 0),
  ('c2c2c2c2-1111-1111-1111-111111111111',
   'aaaaaaaa-1111-1111-1111-111111111111',
   'Lanjutkan pengantaran dan abaikan peringatannya', 1)
on conflict (id) do update set description = excluded.description;

-- ---- Komik 2: "Penjelajah Pasang" -----------------------------------------
insert into public.comics (id, title, description, cover_image_url) values
  ('22222222-2222-2222-2222-222222222222',
   'Penjelajah Pasang',
   'Di sebuah pulau tempat laut berbicara lewat pasang surut, seorang penyelam muda mendengar laut memanggil namanya. Misteri hangat penuh petualangan tentang samudra dan orang-orang yang mendengarkannya.',
   'https://picsum.photos/seed/tide-cover/600/800')
on conflict (id) do update
  set title = excluded.title,
      description = excluded.description,
      cover_image_url = excluded.cover_image_url;

insert into public.chapters (id, comic_id, chapter_number, title, content_text, image_urls) values
  ('aaaaaaaa-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   1,
   'Bab 1 — Surut Terendah',
   'Pagi ketika laut surut lebih jauh dari yang bisa diingat siapa pun, Mira menemukan tangga batu itu. Tangga itu berkelok turun ke tempat yang biasanya tertutup air, licin dan setua yang tak terbayangkan, berdengung pelan setiap kali ombak mundur. Peringatan neneknya bergema di telinganya — jangan pernah mengikuti pasang saat ia memanggil. Tapi ia memang memanggil. Dengan jelas. Menyebut namanya.',
   '["https://picsum.photos/seed/tide-1a/800/450", "https://picsum.photos/seed/tide-1b/800/450"]'::jsonb)
on conflict (id) do update
  set title = excluded.title, content_text = excluded.content_text, image_urls = excluded.image_urls;

insert into public.choices (id, chapter_id, description, sort_order) values
  ('c1c1c1c1-2222-2222-2222-222222222222',
   'aaaaaaaa-2222-2222-2222-222222222222',
   'Susuri tangga kuno menuju panggilan laut', 0),
  ('c2c2c2c2-2222-2222-2222-222222222222',
   'aaaaaaaa-2222-2222-2222-222222222222',
   'Kembali ke desa dan ungkap rahasia sang nenek', 1)
on conflict (id) do update set description = excluded.description;
