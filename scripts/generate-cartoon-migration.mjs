import { readFileSync, writeFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8").replace(/^\uFEFF/, "");
const { works } = JSON.parse(
  read("catalogue/dessins-animes-100.recherche.json"),
);
const references = JSON.parse(read("catalogue/references-fr.json"));
if (
  works.length !== 100 ||
  new Set(works.map((w) => w.editorial_id)).size !== 100 ||
  works.some(
    (w) =>
      w.audio_path || w.image_path || w.media_license_status !== "unverified",
  )
)
  throw new Error("Unexpected draft manifest");
const normalize = (value) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const rows = works.map((work) => ({
  id: work.editorial_id,
  title: work.title,
  aliases: [
    ...new Map(
      work.aliases.map((alias) => [
        normalize(alias),
        { alias, normalized: normalize(alias) },
      ]),
    ).values(),
  ],
  research: {
    ...work.research,
    query: work.theme_search,
    verified_reference: references[work.editorial_id] ?? null,
  },
}));
const save = read(
  "supabase/migrations/20261108143010_fix_catalogue_transaction.sql",
)
  .replace(
    "important_words,rights_source)",
    "important_words,rights_source,image_license,image_attribution)",
  )
  .replace(
    "w->>'rights_source')",
    "w->>'rights_source',w->>'image_license',w->>'image_attribution')",
  )
  .replace(
    "rights_source=excluded.rights_source;",
    "rights_source=excluded.rights_source,image_license=excluded.image_license,image_attribution=excluded.image_attribution;",
  )
  .replace(
    "is_active,rights_status) values",
    "is_active,rights_status,license_reference,previewed) values",
  )
  .replace(
    "c->>'rights_status');",
    "c->>'rights_status',c->>'license_reference',coalesce((c->>'previewed')::boolean,false));",
  );
writeFileSync(
  "supabase/migrations/20261109180350_cartoon_drafts.sql",
  `-- Editorial references and media reviews are private under the existing catalogue RLS.
alter table public.works add column editorial_id text unique, add column research jsonb, add column image_license text, add column image_attribution text;
alter table public.audio_clips add column license_reference text, add column previewed boolean not null default false;

${save}
-- Existing works are preserved. The new entries are inactive and have no media.
do $$
declare w jsonb; a jsonb; work_id uuid; category_id uuid;
begin
  select id into strict category_id from public.categories where slug='dessins-animes';
  for w in select value from jsonb_array_elements($catalogue$${JSON.stringify(rows, null, 2)}$catalogue$::jsonb) loop
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
`,
);
