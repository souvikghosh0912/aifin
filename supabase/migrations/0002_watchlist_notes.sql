-- 0002_watchlist_notes.sql
-- Add optional notes column to watchlist_items with a 500-char cap.
alter table public.watchlist_items
  add column notes text;

alter table public.watchlist_items
  add constraint watchlist_items_notes_len
  check (notes is null or char_length(notes) <= 500);
