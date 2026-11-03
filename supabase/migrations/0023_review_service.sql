-- Which service a review is about, so the homepage shows slideshow reviews and /ugc shows UGC reviews.
alter table public.reviews add column if not exists service text not null default 'slideshows' check (service in ('slideshows', 'ugc'));
