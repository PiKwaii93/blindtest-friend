import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url ?? ""))
  throw new Error("Local Supabase only.");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const clients = [],
  users = [],
  channels = [],
  received = Array.from({ length: 12 }, () => new Map());
const roomId = randomUUID(),
  code = randomUUID().slice(0, 10);
try {
  for (let i = 0; i < 12; i++) {
    const email = `latency-${randomUUID()}@example.test`,
      password = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    users.push(data.user.id);
    const client = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    clients.push(client);
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
  }
  const base = {
    id: roomId,
    code,
    name: "Local transport measurement",
    ownerId: users[0],
    players: users.map((id) => ({ id })),
    game: null,
  };
  const inserted = await admin
    .from("rooms")
    .insert({ id: roomId, code, owner_id: users[0], state: base });
  if (inserted.error) throw inserted.error;
  await Promise.all(
    clients.map(
      (client, i) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Private channel subscription timed out")),
            15000,
          );
          const channel = client
            .channel("room:" + roomId, { config: { private: true } })
            .on("broadcast", { event: "STATE_CHANGED" }, ({ payload }) =>
              received[i].set(payload.version, Date.now()),
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                clearTimeout(timer);
                resolve();
              } else if (status === "CHANNEL_ERROR") {
                clearTimeout(timer);
                reject(new Error("Private channel authorization failed"));
              }
            });
          channels.push(channel);
        }),
    ),
  );
  const samples = [];
  for (let trial = 0; trial < 5; trial++) {
    const now = Date.now();
    const playing = {
      ...base,
      game: {
        phase: "PLAYING",
        startedAt: now - 1000,
        consumedMs: 0,
        deadline: now + 30000,
        settings: { listenSeconds: 30, answerSeconds: 10 },
      },
    };
    const reset = await admin
      .from("rooms")
      .update({ state: playing })
      .eq("id", roomId);
    if (reset.error) throw reset.error;
    const row = await admin.rpc("read_room_clock", { p_code: code });
    if (row.error) throw row.error;
    const next = {
      ...playing,
      game: {
        ...playing.game,
        phase: "ANSWERING",
        attempts: [
          { playerId: users[0], acceptedAt: row.data.now, remainingMs: 29000 },
        ],
        deadline: row.data.now + 10000,
      },
    };
    const committed = await admin.rpc("commit_room", {
      p_id: roomId,
      p_version: row.data.version,
      p_state: next,
      p_observed_at: row.data.now,
      p_event: "BUZZ",
    });
    assert.equal(committed.error, null);
    assert.equal(committed.data, true);
    const target = row.data.version + 1;
    const end = Date.now() + 10000;
    while (received.some((events) => !events.has(target)) && Date.now() < end)
      await new Promise((r) => setTimeout(r, 20));
    assert.ok(
      received.every((events) => events.has(target)),
      "Every authorized participant must receive the event",
    );
    const accepted = await admin.rpc("read_room_clock", { p_code: code });
    const acceptedAt = accepted.data.state.game.attempts[0].acceptedAt;
    samples.push(...received.map((events) => events.get(target) - acceptedAt));
  }
  samples.sort((a, b) => a - b);
  const result = {
    measuredAt: new Date().toISOString(),
    environment:
      "Local Supabase; 12 authenticated SDK clients; one host; no injected latency",
    participants: 12,
    trials: 5,
    deliveries: samples.length,
    acceptanceToBroadcastMs: {
      min: samples[0],
      median: samples[Math.floor(samples.length / 2)],
      p95: samples[Math.ceil(samples.length * 0.95) - 1],
      max: samples.at(-1),
    },
    limitations:
      "Transport delivery only. Does not measure acoustic synchronization or Internet latency.",
  };
  writeFileSync(
    "docs/realtime-load.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await Promise.all(clients.map((c) => c.removeAllChannels()));
  await admin.from("rooms").delete().eq("id", roomId);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
