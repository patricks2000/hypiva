-- Reviews in all three site languages (English, Dutch, French). "lang" is the language the client wrote in;
-- "translations" holds the same review in the other languages, e.g. {"nl": "...", "fr": "..."}, added by an admin.
-- The site shows the client's own words on a page in their language, and a translation with a small
-- "Translated from ..." note on the other pages. The older "translation" column (English <-> Dutch) still works.
alter table public.reviews drop constraint if exists reviews_lang_check;
alter table public.reviews add constraint reviews_lang_check check (lang in ('en', 'nl', 'fr'));
alter table public.reviews add column if not exists translations jsonb;

-- Visitors may still only send a hidden review, and never a translation of their own.
alter policy reviews_public_insert on public.reviews with check (approved = false and translation is null and translations is null);
