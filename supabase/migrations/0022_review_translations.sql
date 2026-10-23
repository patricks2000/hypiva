-- Reviews in the site's two languages. "lang" is the language the client wrote in (the page language at the time);
-- "translation" is the same review in the other language, added by an admin. The site shows the translation
-- with a "Translated from ..." note, so visitors know which words are the client's own.
alter table public.reviews add column if not exists lang text not null default 'en' check (lang in ('en', 'nl'));
alter table public.reviews add column if not exists translation text check (translation is null or length(trim(translation)) between 10 and 900);

-- Visitors may still only send a hidden review, and never a translation of their own.
alter policy reviews_public_insert on public.reviews with check (approved = false and translation is null);
