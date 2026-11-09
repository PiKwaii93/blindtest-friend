-- Editorial references and media reviews are private under the existing catalogue RLS.
alter table public.works add column editorial_id text unique, add column research jsonb, add column image_license text, add column image_attribution text;
alter table public.audio_clips add column license_reference text, add column previewed boolean not null default false;

create or replace function public.save_works(p_works jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare w jsonb; a jsonb; c jsonb; category_id text; v_work_id uuid;
begin
 for w in select value from jsonb_array_elements(p_works) loop
  v_work_id:=coalesce((w->>'id')::uuid,gen_random_uuid());
  insert into public.works(id,title,image_path,release_year,is_active,important_words,rights_source,image_license,image_attribution)
  values(v_work_id,w->>'title',w->>'image_path',(w->>'release_year')::integer,(w->>'is_active')::boolean,array(select jsonb_array_elements_text(w->'important_words')),w->>'rights_source',w->>'image_license',w->>'image_attribution')
  on conflict(id) do update set title=excluded.title,image_path=excluded.image_path,release_year=excluded.release_year,is_active=excluded.is_active,important_words=excluded.important_words,rights_source=excluded.rights_source,image_license=excluded.image_license,image_attribution=excluded.image_attribution;
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
   insert into public.audio_clips(work_id,audio_path,difficulty,start_ms,usable_duration_ms,is_active,rights_status,license_reference,previewed) values(v_work_id,c->>'audio_path',c->>'difficulty',(c->>'start_ms')::integer,(c->>'usable_duration_ms')::integer,(c->>'is_active')::boolean,c->>'rights_status',c->>'license_reference',coalesce((c->>'previewed')::boolean,false));
  end loop;
 end loop;
end $$;
revoke all on function public.save_works(jsonb) from public,anon,authenticated;
grant execute on function public.save_works(jsonb) to service_role;


-- Existing works are preserved. The new entries are inactive and have no media.
do $$
declare w jsonb; a jsonb; work_id uuid; category_id uuid;
begin
  select id into strict category_id from public.categories where slug='dessins-animes';
  for w in select value from jsonb_array_elements($catalogue$[
  {
    "id": "da-001",
    "title": "Scooby-Doo",
    "aliases": [
      {
        "alias": "Scooby Doo",
        "normalized": "scooby doo"
      },
      {
        "alias": "Scooby-Doo, où es-tu ?",
        "normalized": "scooby doo ou es tu"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Scooby-Doo%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Scooby-Doo%20animation",
      "documented_theme_url": null,
      "query": "Scooby-Doo générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-002",
    "title": "Tom et Jerry",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Tom%20et%20Jerry%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Tom%20et%20Jerry%20animation",
      "documented_theme_url": null,
      "query": "Tom et Jerry générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-003",
    "title": "Looney Tunes",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Looney%20Tunes%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Looney%20Tunes%20animation",
      "documented_theme_url": null,
      "query": "Looney Tunes générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-004",
    "title": "Les Pierrafeu",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Pierrafeu%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Pierrafeu%20animation",
      "documented_theme_url": null,
      "query": "Les Pierrafeu générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-005",
    "title": "Les Jetsons",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Jetsons%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Jetsons%20animation",
      "documented_theme_url": null,
      "query": "Les Jetsons générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-006",
    "title": "La Panthère rose",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Panth%C3%A8re%20rose%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Panth%C3%A8re%20rose%20animation",
      "documented_theme_url": null,
      "query": "La Panthère rose générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-007",
    "title": "Le Manège enchanté",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Le%20Man%C3%A8ge%20enchant%C3%A9%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Le%20Man%C3%A8ge%20enchant%C3%A9%20animation",
      "documented_theme_url": null,
      "query": "Le Manège enchanté générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-008",
    "title": "Barbapapa",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Barbapapa%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Barbapapa%20animation",
      "documented_theme_url": null,
      "query": "Barbapapa générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-009",
    "title": "Les Schtroumpfs",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Schtroumpfs%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Schtroumpfs%20animation",
      "documented_theme_url": null,
      "query": "Les Schtroumpfs générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-010",
    "title": "Inspecteur Gadget",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Inspecteur%20Gadget%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Inspecteur%20Gadget%20animation",
      "documented_theme_url": "https://musee.sacem.fr/index.php/ExhibitionCMS/ExhibitionCMS/View?id=5877",
      "query": "Inspecteur Gadget générique français dessin animé",
      "verified_reference": {
        "url": "https://musee.sacem.fr/index.php/Detail/objects/9024",
        "note": "Bulletin du générique. Version française chantée par Jacques Cardona, selon l’exposition Sacem."
      }
    }
  },
  {
    "id": "da-011",
    "title": "Les Mystérieuses Cités d'or",
    "aliases": [
      {
        "alias": "Les Cités d'or",
        "normalized": "les cites d or"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Myst%C3%A9rieuses%20Cit%C3%A9s%20d'or%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Myst%C3%A9rieuses%20Cit%C3%A9s%20d'or%20animation",
      "documented_theme_url": "https://musee.sacem.fr/index.php/ExhibitionCMS/ExhibitionCMS/View?id=5877",
      "query": "Les Mystérieuses Cités d'or générique français dessin animé",
      "verified_reference": {
        "url": "https://musee.sacem.fr/index.php/Detail/objects/126702",
        "note": "Bulletin du générique de 1982. Version chantée par Jacques Cardona sous le nom Apollo, selon l’exposition Sacem."
      }
    }
  },
  {
    "id": "da-012",
    "title": "Ulysse 31",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Ulysse%2031%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Ulysse%2031%20animation",
      "documented_theme_url": "https://musee.sacem.fr/index.php/ExhibitionCMS/ExhibitionCMS/View?id=5877",
      "query": "Ulysse 31 générique français dessin animé",
      "verified_reference": {
        "url": "https://musee.sacem.fr/index.php/Detail/objects/97331",
        "note": "Bulletin de déclaration. Distinguer la version originale de Lionel Leroy et Ulysse revient de Jacques Cardona (1983)."
      }
    }
  },
  {
    "id": "da-013",
    "title": "Les Minipouss",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Minipouss%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Minipouss%20animation",
      "documented_theme_url": "https://musee.sacem.fr/index.php/ExhibitionCMS/ExhibitionCMS/View?id=5877",
      "query": "Les Minipouss générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-014",
    "title": "Les Entrechats",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Entrechats%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Entrechats%20animation",
      "documented_theme_url": "https://musee.sacem.fr/index.php/ExhibitionCMS/ExhibitionCMS/View?id=5877",
      "query": "Les Entrechats générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-015",
    "title": "Les Bisounours",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Bisounours%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Bisounours%20animation",
      "documented_theme_url": null,
      "query": "Les Bisounours générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-016",
    "title": "Les Gummi",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Gummi%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Gummi%20animation",
      "documented_theme_url": null,
      "query": "Les Gummi générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-017",
    "title": "La Bande à Picsou",
    "aliases": [
      {
        "alias": "DuckTales",
        "normalized": "ducktales"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Bande%20%C3%A0%20Picsou%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Bande%20%C3%A0%20Picsou%20animation",
      "documented_theme_url": null,
      "query": "La Bande à Picsou générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-018",
    "title": "Il était une fois… la Vie",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Il%20%C3%A9tait%20une%20fois%E2%80%A6%20la%20Vie%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Il%20%C3%A9tait%20une%20fois%E2%80%A6%20la%20Vie%20animation",
      "documented_theme_url": null,
      "query": "Il était une fois… la Vie générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-019",
    "title": "Les Tortues Ninja",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Tortues%20Ninja%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Tortues%20Ninja%20animation",
      "documented_theme_url": null,
      "query": "Les Tortues Ninja générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-020",
    "title": "Denver, le dernier dinosaure",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Denver%2C%20le%20dernier%20dinosaure%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Denver%2C%20le%20dernier%20dinosaure%20animation",
      "documented_theme_url": null,
      "query": "Denver, le dernier dinosaure générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-021",
    "title": "Tic et Tac, les rangers du risque",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Tic%20et%20Tac%2C%20les%20rangers%20du%20risque%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Tic%20et%20Tac%2C%20les%20rangers%20du%20risque%20animation",
      "documented_theme_url": null,
      "query": "Tic et Tac, les rangers du risque générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-022",
    "title": "Les Nouvelles Aventures de Winnie l'ourson",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Nouvelles%20Aventures%20de%20Winnie%20l'ourson%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Nouvelles%20Aventures%20de%20Winnie%20l'ourson%20animation",
      "documented_theme_url": null,
      "query": "Les Nouvelles Aventures de Winnie l'ourson générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-023",
    "title": "Super Baloo",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Super%20Baloo%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Super%20Baloo%20animation",
      "documented_theme_url": null,
      "query": "Super Baloo générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-024",
    "title": "Myster Mask",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Myster%20Mask%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Myster%20Mask%20animation",
      "documented_theme_url": null,
      "query": "Myster Mask générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-025",
    "title": "La Bande à Dingo",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Bande%20%C3%A0%20Dingo%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Bande%20%C3%A0%20Dingo%20animation",
      "documented_theme_url": null,
      "query": "La Bande à Dingo générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-026",
    "title": "La Petite Sirène, la série",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Petite%20Sir%C3%A8ne%2C%20la%20s%C3%A9rie%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Petite%20Sir%C3%A8ne%2C%20la%20s%C3%A9rie%20animation",
      "documented_theme_url": null,
      "query": "La Petite Sirène, la série générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-027",
    "title": "Aladdin, la série",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Aladdin%2C%20la%20s%C3%A9rie%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Aladdin%2C%20la%20s%C3%A9rie%20animation",
      "documented_theme_url": null,
      "query": "Aladdin, la série générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-028",
    "title": "Gargoyles, les anges de la nuit",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Gargoyles%2C%20les%20anges%20de%20la%20nuit%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Gargoyles%2C%20les%20anges%20de%20la%20nuit%20animation",
      "documented_theme_url": null,
      "query": "Gargoyles, les anges de la nuit générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-029",
    "title": "Le Laboratoire de Dexter",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Le%20Laboratoire%20de%20Dexter%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Le%20Laboratoire%20de%20Dexter%20animation",
      "documented_theme_url": null,
      "query": "Le Laboratoire de Dexter générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-030",
    "title": "Johnny Bravo",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Johnny%20Bravo%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Johnny%20Bravo%20animation",
      "documented_theme_url": null,
      "query": "Johnny Bravo générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-031",
    "title": "Les Supers Nanas",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Supers%20Nanas%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Supers%20Nanas%20animation",
      "documented_theme_url": null,
      "query": "Les Supers Nanas générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-032",
    "title": "Courage, le chien froussard",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Courage%2C%20le%20chien%20froussard%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Courage%2C%20le%20chien%20froussard%20animation",
      "documented_theme_url": null,
      "query": "Courage, le chien froussard générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-033",
    "title": "Ed, Edd et Eddy",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Ed%2C%20Edd%20et%20Eddy%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Ed%2C%20Edd%20et%20Eddy%20animation",
      "documented_theme_url": null,
      "query": "Ed, Edd et Eddy générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-034",
    "title": "Les Razmoket",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Razmoket%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Razmoket%20animation",
      "documented_theme_url": null,
      "query": "Les Razmoket générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-035",
    "title": "Hé Arnold !",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=H%C3%A9%20Arnold%20!%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=H%C3%A9%20Arnold%20!%20animation",
      "documented_theme_url": null,
      "query": "Hé Arnold ! générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-036",
    "title": "Doug",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Doug%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Doug%20animation",
      "documented_theme_url": null,
      "query": "Doug générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-037",
    "title": "Les Animaniacs",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Animaniacs%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Animaniacs%20animation",
      "documented_theme_url": null,
      "query": "Les Animaniacs générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-038",
    "title": "Minus et Cortex",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Minus%20et%20Cortex%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Minus%20et%20Cortex%20animation",
      "documented_theme_url": null,
      "query": "Minus et Cortex générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-039",
    "title": "La Cour de récré",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Cour%20de%20r%C3%A9cr%C3%A9%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Cour%20de%20r%C3%A9cr%C3%A9%20animation",
      "documented_theme_url": null,
      "query": "La Cour de récré générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-040",
    "title": "Timon et Pumbaa",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Timon%20et%20Pumbaa%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Timon%20et%20Pumbaa%20animation",
      "documented_theme_url": null,
      "query": "Timon et Pumbaa générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-041",
    "title": "La Famille Pirate",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Famille%20Pirate%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Famille%20Pirate%20animation",
      "documented_theme_url": null,
      "query": "La Famille Pirate générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-042",
    "title": "Les Zinzins de l'espace",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Zinzins%20de%20l'espace%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Zinzins%20de%20l'espace%20animation",
      "documented_theme_url": null,
      "query": "Les Zinzins de l'espace générique français dessin animé",
      "verified_reference": {
        "url": "https://xilam.com/media/les-zinzins-de-lespace/",
        "note": "Fiche officielle Xilam. Identifier la saison et la version musicale avant de choisir un extrait."
      }
    }
  },
  {
    "id": "da-043",
    "title": "Oggy et les Cafards",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Oggy%20et%20les%20Cafards%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Oggy%20et%20les%20Cafards%20animation",
      "documented_theme_url": null,
      "query": "Oggy et les Cafards générique français dessin animé",
      "verified_reference": {
        "url": "https://xilam.com/wp-content/uploads/2018/10/XILAM-CP-Conf%C3%A9rence-de-presse-Le-succ%C3%A8s-mondial-dun-studio-danimation-fran%C3%A7ais.pdf",
        "note": "Dossier du producteur sur la série originale. Le générique et ses droits restent à confirmer."
      }
    }
  },
  {
    "id": "da-044",
    "title": "Les Simpson",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Simpson%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Simpson%20animation",
      "documented_theme_url": null,
      "query": "Les Simpson générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-045",
    "title": "Futurama",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Futurama%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Futurama%20animation",
      "documented_theme_url": null,
      "query": "Futurama générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-046",
    "title": "Bob l'éponge",
    "aliases": [
      {
        "alias": "SpongeBob SquarePants",
        "normalized": "spongebob squarepants"
      },
      {
        "alias": "SpongeBob",
        "normalized": "spongebob"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Bob%20l'%C3%A9ponge%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Bob%20l'%C3%A9ponge%20animation",
      "documented_theme_url": null,
      "query": "Bob l'éponge générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-047",
    "title": "Totally Spies !",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Totally%20Spies%20!%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Totally%20Spies%20!%20animation",
      "documented_theme_url": null,
      "query": "Totally Spies ! générique français dessin animé",
      "verified_reference": {
        "url": "https://www.banijaykidsandfamily.com/shows/totally-spies/",
        "note": "Fiche Banijay. Préciser la saison de la version française, le catalogue couvre plusieurs époques."
      }
    }
  },
  {
    "id": "da-048",
    "title": "Code Lyoko",
    "aliases": [
      {
        "alias": "Lyoko",
        "normalized": "lyoko"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Code%20Lyoko%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Code%20Lyoko%20animation",
      "documented_theme_url": null,
      "query": "Code Lyoko générique français dessin animé",
      "verified_reference": {
        "url": "https://mediatoon-distribution.com/programme/code-lyoko/",
        "note": "Fiche du distributeur. Identifier le générique de la série originale, distinct de Code Lyoko Évolution."
      }
    }
  },
  {
    "id": "da-049",
    "title": "Titeuf",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Titeuf%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Titeuf%20animation",
      "documented_theme_url": null,
      "query": "Titeuf générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-050",
    "title": "Martin Mystère",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Martin%20Myst%C3%A8re%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Martin%20Myst%C3%A8re%20animation",
      "documented_theme_url": null,
      "query": "Martin Mystère générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-051",
    "title": "Ratz",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Ratz%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Ratz%20animation",
      "documented_theme_url": null,
      "query": "Ratz générique français dessin animé",
      "verified_reference": {
        "url": "https://xilam.com/wp-content/uploads/2024/07/Xilam_2024-07-31_CP-Partenariat-CELIO.pdf",
        "note": "Le communiqué du producteur mentionne le générique de Ratz. Le fichier et les droits audio restent à obtenir."
      }
    }
  },
  {
    "id": "da-052",
    "title": "Corneil et Bernie",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Corneil%20et%20Bernie%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Corneil%20et%20Bernie%20animation",
      "documented_theme_url": null,
      "query": "Corneil et Bernie générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-053",
    "title": "Foot 2 rue",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Foot%202%20rue%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Foot%202%20rue%20animation",
      "documented_theme_url": null,
      "query": "Foot 2 rue générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-054",
    "title": "Galactik Football",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Galactik%20Football%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Galactik%20Football%20animation",
      "documented_theme_url": null,
      "query": "Galactik Football générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-055",
    "title": "Wakfu",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Wakfu%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Wakfu%20animation",
      "documented_theme_url": null,
      "query": "Wakfu générique français dessin animé",
      "verified_reference": {
        "url": "https://support.ankama.com/hc/fr/articles/21538780273809-La-diffusion-de-WAKFU-saison-4",
        "note": "Ankama confirme la version française de la saison 4. La version du générique reste à sélectionner."
      }
    }
  },
  {
    "id": "da-056",
    "title": "Winx Club",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Winx%20Club%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Winx%20Club%20animation",
      "documented_theme_url": null,
      "query": "Winx Club générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-057",
    "title": "W.I.T.C.H.",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=W.I.T.C.H.%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=W.I.T.C.H.%20animation",
      "documented_theme_url": null,
      "query": "W.I.T.C.H. générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-058",
    "title": "Kim Possible",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Kim%20Possible%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Kim%20Possible%20animation",
      "documented_theme_url": null,
      "query": "Kim Possible générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-059",
    "title": "Phinéas et Ferb",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Phin%C3%A9as%20et%20Ferb%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Phin%C3%A9as%20et%20Ferb%20animation",
      "documented_theme_url": null,
      "query": "Phinéas et Ferb générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-060",
    "title": "La Famille Delajungle",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Famille%20Delajungle%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Famille%20Delajungle%20animation",
      "documented_theme_url": null,
      "query": "La Famille Delajungle générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-061",
    "title": "Jimmy Neutron",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Jimmy%20Neutron%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Jimmy%20Neutron%20animation",
      "documented_theme_url": null,
      "query": "Jimmy Neutron générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-062",
    "title": "Mes parrains sont magiques",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Mes%20parrains%20sont%20magiques%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Mes%20parrains%20sont%20magiques%20animation",
      "documented_theme_url": null,
      "query": "Mes parrains sont magiques générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-063",
    "title": "Danny Fantôme",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Danny%20Fant%C3%B4me%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Danny%20Fant%C3%B4me%20animation",
      "documented_theme_url": null,
      "query": "Danny Fantôme générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-064",
    "title": "Avatar, le dernier maître de l'air",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Avatar%2C%20le%20dernier%20ma%C3%AEtre%20de%20l'air%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Avatar%2C%20le%20dernier%20ma%C3%AEtre%20de%20l'air%20animation",
      "documented_theme_url": null,
      "query": "Avatar, le dernier maître de l'air générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-065",
    "title": "Ben 10",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Ben%2010%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Ben%2010%20animation",
      "documented_theme_url": null,
      "query": "Ben 10 générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-066",
    "title": "American Dragon : Jake Long",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=American%20Dragon%20%3A%20Jake%20Long%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=American%20Dragon%20%3A%20Jake%20Long%20animation",
      "documented_theme_url": null,
      "query": "American Dragon : Jake Long générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-067",
    "title": "Les Aventures de Jackie Chan",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Aventures%20de%20Jackie%20Chan%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Aventures%20de%20Jackie%20Chan%20animation",
      "documented_theme_url": null,
      "query": "Les Aventures de Jackie Chan générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-068",
    "title": "Dora l'exploratrice",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Dora%20l'exploratrice%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Dora%20l'exploratrice%20animation",
      "documented_theme_url": null,
      "query": "Dora l'exploratrice générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-069",
    "title": "Clifford, le gros chien rouge",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Clifford%2C%20le%20gros%20chien%20rouge%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Clifford%2C%20le%20gros%20chien%20rouge%20animation",
      "documented_theme_url": null,
      "query": "Clifford, le gros chien rouge générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-070",
    "title": "Charlotte aux fraises",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Charlotte%20aux%20fraises%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Charlotte%20aux%20fraises%20animation",
      "documented_theme_url": null,
      "query": "Charlotte aux fraises générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-071",
    "title": "Petit Ours Brun",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Petit%20Ours%20Brun%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Petit%20Ours%20Brun%20animation",
      "documented_theme_url": null,
      "query": "Petit Ours Brun générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-072",
    "title": "Les Lascars",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Lascars%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Lascars%20animation",
      "documented_theme_url": null,
      "query": "Les Lascars générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-073",
    "title": "Funky Cops",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Funky%20Cops%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Funky%20Cops%20animation",
      "documented_theme_url": null,
      "query": "Funky Cops générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-074",
    "title": "Les Minijusticiers",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Minijusticiers%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Minijusticiers%20animation",
      "documented_theme_url": null,
      "query": "Les Minijusticiers générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-075",
    "title": "Garfield & Cie",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Garfield%20%26%20Cie%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Garfield%20%26%20Cie%20animation",
      "documented_theme_url": null,
      "query": "Garfield & Cie générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-076",
    "title": "Adventure Time",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Adventure%20Time%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Adventure%20Time%20animation",
      "documented_theme_url": null,
      "query": "Adventure Time générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-077",
    "title": "Le Monde incroyable de Gumball",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Le%20Monde%20incroyable%20de%20Gumball%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Le%20Monde%20incroyable%20de%20Gumball%20animation",
      "documented_theme_url": null,
      "query": "Le Monde incroyable de Gumball générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-078",
    "title": "Regular Show",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Regular%20Show%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Regular%20Show%20animation",
      "documented_theme_url": null,
      "query": "Regular Show générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-079",
    "title": "Steven Universe",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Steven%20Universe%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Steven%20Universe%20animation",
      "documented_theme_url": null,
      "query": "Steven Universe générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-080",
    "title": "Souvenirs de Gravity Falls",
    "aliases": [
      {
        "alias": "Gravity Falls",
        "normalized": "gravity falls"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Souvenirs%20de%20Gravity%20Falls%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Souvenirs%20de%20Gravity%20Falls%20animation",
      "documented_theme_url": null,
      "query": "Souvenirs de Gravity Falls générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-081",
    "title": "Teen Titans Go!",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Teen%20Titans%20Go!%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Teen%20Titans%20Go!%20animation",
      "documented_theme_url": null,
      "query": "Teen Titans Go! générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-082",
    "title": "Miraculous : Les Aventures de Ladybug et Chat Noir",
    "aliases": [
      {
        "alias": "Miraculous",
        "normalized": "miraculous"
      },
      {
        "alias": "Ladybug et Chat Noir",
        "normalized": "ladybug et chat noir"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Miraculous%20%3A%20Les%20Aventures%20de%20Ladybug%20et%20Chat%20Noir%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Miraculous%20%3A%20Les%20Aventures%20de%20Ladybug%20et%20Chat%20Noir%20animation",
      "documented_theme_url": null,
      "query": "Miraculous : Les Aventures de Ladybug et Chat Noir générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-083",
    "title": "Les Sisters",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Sisters%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Sisters%20animation",
      "documented_theme_url": null,
      "query": "Les Sisters générique français dessin animé",
      "verified_reference": {
        "url": "https://mediatoon-distribution.com/programme/les-sisters/",
        "note": "Fiche du distributeur de la série française de 2017. Vérifier la piste du générique séparément."
      }
    }
  },
  {
    "id": "da-084",
    "title": "Grizzy et les Lemmings",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Grizzy%20et%20les%20Lemmings%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Grizzy%20et%20les%20Lemmings%20animation",
      "documented_theme_url": null,
      "query": "Grizzy et les Lemmings générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-085",
    "title": "Peppa Pig",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Peppa%20Pig%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Peppa%20Pig%20animation",
      "documented_theme_url": null,
      "query": "Peppa Pig générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-086",
    "title": "La Pat' Patrouille",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=La%20Pat'%20Patrouille%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=La%20Pat'%20Patrouille%20animation",
      "documented_theme_url": null,
      "query": "La Pat' Patrouille générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-087",
    "title": "Masha et Michka",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Masha%20et%20Michka%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Masha%20et%20Michka%20animation",
      "documented_theme_url": null,
      "query": "Masha et Michka générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-088",
    "title": "Bienvenue chez les Loud",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Bienvenue%20chez%20les%20Loud%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Bienvenue%20chez%20les%20Loud%20animation",
      "documented_theme_url": null,
      "query": "Bienvenue chez les Loud générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-089",
    "title": "Ninjago : Les Maîtres du Spinjitzu",
    "aliases": [
      {
        "alias": "Ninjago",
        "normalized": "ninjago"
      }
    ],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Ninjago%20%3A%20Les%20Ma%C3%AEtres%20du%20Spinjitzu%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Ninjago%20%3A%20Les%20Ma%C3%AEtres%20du%20Spinjitzu%20animation",
      "documented_theme_url": null,
      "query": "Ninjago : Les Maîtres du Spinjitzu générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-090",
    "title": "My Little Pony : Les amies, c'est magique",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=My%20Little%20Pony%20%3A%20Les%20amies%2C%20c'est%20magique%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=My%20Little%20Pony%20%3A%20Les%20amies%2C%20c'est%20magique%20animation",
      "documented_theme_url": null,
      "query": "My Little Pony : Les amies, c'est magique générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-091",
    "title": "Dragons : Cavaliers de Beurk",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Dragons%20%3A%20Cavaliers%20de%20Beurk%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Dragons%20%3A%20Cavaliers%20de%20Beurk%20animation",
      "documented_theme_url": null,
      "query": "Dragons : Cavaliers de Beurk générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-092",
    "title": "Sanjay et Craig",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Sanjay%20et%20Craig%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Sanjay%20et%20Craig%20animation",
      "documented_theme_url": null,
      "query": "Sanjay et Craig générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-093",
    "title": "LoliRock",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=LoliRock%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=LoliRock%20animation",
      "documented_theme_url": null,
      "query": "LoliRock générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-094",
    "title": "Zig et Sharko",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Zig%20et%20Sharko%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Zig%20et%20Sharko%20animation",
      "documented_theme_url": null,
      "query": "Zig et Sharko générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-095",
    "title": "Oscar et Malika, toujours en retard",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Oscar%20et%20Malika%2C%20toujours%20en%20retard%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Oscar%20et%20Malika%2C%20toujours%20en%20retard%20animation",
      "documented_theme_url": null,
      "query": "Oscar et Malika, toujours en retard générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-096",
    "title": "Bluey",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Bluey%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Bluey%20animation",
      "documented_theme_url": null,
      "query": "Bluey générique français dessin animé",
      "verified_reference": {
        "url": "https://www.bluey.tv/bluey-in-other-languages/",
        "note": "Le site officiel répertorie l’édition française. Le générique à utiliser reste à vérifier."
      }
    }
  },
  {
    "id": "da-097",
    "title": "Sonic Prime",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Sonic%20Prime%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Sonic%20Prime%20animation",
      "documented_theme_url": null,
      "query": "Sonic Prime générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-098",
    "title": "Les Aventures de Paddington",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Aventures%20de%20Paddington%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Aventures%20de%20Paddington%20animation",
      "documented_theme_url": null,
      "query": "Les Aventures de Paddington générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-099",
    "title": "Le Cuphead Show !",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Le%20Cuphead%20Show%20!%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Le%20Cuphead%20Show%20!%20animation",
      "documented_theme_url": null,
      "query": "Le Cuphead Show ! générique français dessin animé",
      "verified_reference": null
    }
  },
  {
    "id": "da-100",
    "title": "Les Lapins Crétins : Invasion",
    "aliases": [],
    "research": {
      "youtube_search": "https://www.youtube.com/results?search_query=Les%20Lapins%20Cr%C3%A9tins%20%3A%20Invasion%20g%C3%A9n%C3%A9rique%20fran%C3%A7ais%20dessin%20anim%C3%A9",
      "wikimedia_image_search": "https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=Les%20Lapins%20Cr%C3%A9tins%20%3A%20Invasion%20animation",
      "documented_theme_url": null,
      "query": "Les Lapins Crétins : Invasion générique français dessin animé",
      "verified_reference": null
    }
  }
]$catalogue$::jsonb) loop
    insert into public.works(title, editorial_id, research, is_active, rights_source)
    values (w->>'title', w->>'id', w->'research', false, 'Droits audio et illustration à vérifier')
    on conflict do nothing returning id into work_id;
    if work_id is not null then
      insert into public.work_categories values(work_id,category_id);
      for a in select value from jsonb_array_elements(w->'aliases') loop
        insert into public.work_aliases(work_id,alias,normalized_alias) values(work_id,a->>'alias',a->>'normalized');
      end loop;
    end if;
  end loop;
end $$;
