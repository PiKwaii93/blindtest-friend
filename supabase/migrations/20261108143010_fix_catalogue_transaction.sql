create or replace function public.save_works(p_works jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare w jsonb; a jsonb; c jsonb; category_id text; v_work_id uuid;
begin
 for w in select value from jsonb_array_elements(p_works) loop
  v_work_id:=coalesce((w->>'id')::uuid,gen_random_uuid());
  insert into public.works(id,title,image_path,release_year,is_active,important_words,rights_source)
  values(v_work_id,w->>'title',w->>'image_path',(w->>'release_year')::integer,(w->>'is_active')::boolean,array(select jsonb_array_elements_text(w->'important_words')),w->>'rights_source')
  on conflict(id) do update set title=excluded.title,image_path=excluded.image_path,release_year=excluded.release_year,is_active=excluded.is_active,important_words=excluded.important_words,rights_source=excluded.rights_source;
  delete from public.work_aliases where public.work_aliases.work_id=v_work_id;
  delete from public.work_categories where public.work_categories.work_id=v_work_id;
  delete from public.audio_clips where public.audio_clips.work_id=v_work_id;
  for a in select value from jsonb_array_elements(w->'aliases') loop
   insert into public.work_aliases(work_id,alias,normalized_alias) values(v_work_id,a->>'alias',a->>'normalized_alias');
  end loop;
  for category_id in select jsonb_array_elements_text(w->'categories') loop
   insert into public.work_categories values(v_work_id,category_id::uuid);
  end loop;
  for c in select value from jsonb_array_elements(w->'clips') loop
   insert into public.audio_clips(work_id,audio_path,difficulty,start_ms,usable_duration_ms,is_active,rights_status) values(v_work_id,c->>'audio_path',c->>'difficulty',(c->>'start_ms')::integer,(c->>'usable_duration_ms')::integer,(c->>'is_active')::boolean,c->>'rights_status');
  end loop;
 end loop;
end $$;
revoke all on function public.save_works(jsonb) from public,anon,authenticated;
grant execute on function public.save_works(jsonb) to service_role;

