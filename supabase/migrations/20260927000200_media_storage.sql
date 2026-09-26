insert into storage.buckets (id, name, public)
values ('kiorel-media', 'kiorel-media', false)
on conflict (id) do nothing;
