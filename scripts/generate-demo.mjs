// Original procedural motifs, no recording or composition from a third party.
// CC0: these demo assets may be copied, modified and redistributed.
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
mkdirSync("public/demo", { recursive: true });
const sql = [];
const names = [];
const colors = ["Lilas", "Azur", "Corail", "Jade", "Ambre", "Indigo", "Opale"];
for (let i = 0; i < 56; i++) {
  const hash = createHash("sha256")
    .update("encore-original-" + i)
    .digest("hex");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const title = `Signal ${colors[i % 7]} ${Math.floor(i / 7) + 1}`;
  names.push(title);
  const rate = 8000,
    seconds = 31,
    count = rate * seconds,
    buffer = Buffer.alloc(44 + count * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(count * 2, 40);
  for (let sample = 0; sample < count; sample++) {
    const t = sample / rate;
    const step = Math.floor(t / (0.24 + (i % 5) * 0.035));
    const note = [0, 3, 7, 10, 12, 7, 3, 5][(step + i) % 8] + Math.floor(i / 7);
    const freq = 130.81 * 2 ** (note / 12);
    const envelope =
      Math.min(1, (t % (0.24 + (i % 5) * 0.035)) * 70) *
      Math.exp(-5 * (t % (0.24 + (i % 5) * 0.035)));
    const fade = Math.min(1, t * 10, (seconds - t) * 10);
    const y =
      (Math.sin(2 * Math.PI * freq * t) +
        0.25 * Math.sin(4 * Math.PI * freq * t)) *
      envelope *
      fade *
      0.22;
    buffer.writeInt16LE(Math.round(y * 32767), 44 + sample * 2);
  }
  writeFileSync(`public/demo/${id}.wav`, buffer);
  sql.push(
    `insert into public.works(id,title,rights_source) values('${id}','${title}','Original procedural demo; CC0; scripts/generate-demo.mjs') on conflict(id) do nothing;`,
  );
  sql.push(
    `insert into public.work_categories select '${id}',id from public.categories where slug='${["jeux-video", "films", "series", "dessins-animes", "animes", "musiques", "generiques"][i % 7]}' on conflict do nothing;`,
  );
  for (const difficulty of ["easy", "normal", "hard"])
    sql.push(
      `insert into public.audio_clips(work_id,audio_path,difficulty,start_ms,usable_duration_ms,rights_status) select '${id}','demo/${id}.wav','${difficulty}',0,31000,'authorized' where not exists(select 1 from public.audio_clips where work_id='${id}' and difficulty='${difficulty}');`,
    );
}
writeFileSync("supabase/seed.sql", sql.join("\n") + "\n");
writeFileSync(
  "public/demo/README.txt",
  "DEMONSTRATION TECHNIQUE — 56 motifs originaux CC0.\nCes motifs ne sont pas des chansons connues. Les catégories servent uniquement à tester les filtres.\nIls permettent de tester 10 à 50 manches sans utiliser de musique tierce.\nPour une vraie soirée, importer un catalogue dont les droits sont obtenus.\n\n" +
    names.join("\n"),
);
console.log("56 original audio files and idempotent seed generated.");
