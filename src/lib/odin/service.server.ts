import { makeScenario } from "./scenario.ts";
import { runSteps } from "./step.ts";
import type { Command, ScenarioId, World } from "./types.ts";

export type Role = "observer" | "analyst" | "commander";

const SCENARIOS = new Set<ScenarioId>(["hearth", "harbor", "gallery"]);

interface Slot {
  world: World;
  chain: Promise<unknown>;
}

const g = globalThis as typeof globalThis & { __daemonSlots__?: Map<string, Slot> };

function slots(): Map<string, Slot> {
  if (!g.__daemonSlots__) g.__daemonSlots__ = new Map();
  return g.__daemonSlots__;
}

export function asRole(value: unknown): Role {
  if (value === "observer" || value === "analyst" || value === "commander") return value;
  return "observer";
}

export function asScenario(value: unknown): ScenarioId {
  if (value === "harbor" || value === "gallery" || value === "hearth") return value;
  return "hearth";
}

function gated(command: Command): boolean {
  return (
    command.type === "approve" ||
    command.type === "deny" ||
    command.type === "roe" ||
    command.type === "launch" ||
    command.type === "adopt"
  );
}

function assertClearance(role: Role, commands: Command[]): void {
  if (role === "commander") return;
  if (commands.some(gated)) {
    throw new Error("Commander clearance required. The picture was not changed.");
  }
}

function canPersist(): boolean {
  return typeof (import.meta as { glob?: unknown }).glob === "function";
}

async function readDb(id: string): Promise<World | null> {
  if (!canPersist()) return null;
  try {
    const { getSql } = await import("../db.ts");
    const sql = await getSql();
    await sql.query(
      `create table if not exists daemon_exercise (
        id text primary key,
        world text not null,
        updated_at timestamptz not null default current_timestamp
      )`,
    );
    const rows = await sql.query<{ world: string }>("select world from daemon_exercise where id = $1", [id]);
    const raw = rows[0]?.world;
    if (!raw) return null;
    const world = JSON.parse(raw) as World;
    if (!world || !Array.isArray(world.assets) || typeof world.tick !== "number") return null;
    return world;
  } catch (err) {
    console.error("[daemon] read failed", err);
    return null;
  }
}

function writeDb(id: string, world: World): void {
  if (!canPersist()) return;
  void (async () => {
    try {
      const { getSql } = await import("../db.ts");
      const sql = await getSql();
      await sql.query(
        `insert into daemon_exercise (id, world, updated_at) values ($1, $2, now())
         on conflict (id) do update set world = excluded.world, updated_at = now()`,
        [id, JSON.stringify(world)],
      );
    } catch (err) {
      console.error("[daemon] write failed", err);
    }
  })();
}

function enqueue<T>(slot: Slot, job: () => Promise<T>): Promise<T> {
  const run = slot.chain.then(job, job);
  slot.chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function slotFor(id: string): Promise<Slot> {
  const existing = slots().get(id);
  if (existing) return existing;
  const stored = await readDb(id);
  const scenario = SCENARIOS.has(id as ScenarioId) ? (id as ScenarioId) : "hearth";
  const slot: Slot = { world: stored ?? makeScenario(scenario, 1107), chain: Promise.resolve() };
  slots().set(id, slot);
  if (!stored) writeDb(id, slot.world);
  return slot;
}

export async function picture(id: string): Promise<World> {
  const slot = await slotFor(id);
  return enqueue(slot, async () => structuredClone(slot.world));
}

export async function stepExercise(id: string, role: Role, steps: number, commands: Command[]): Promise<World> {
  assertClearance(role, commands);
  const slot = await slotFor(id);
  const n = Math.max(1, Math.min(12, Math.floor(steps)));
  return enqueue(slot, async () => {
    const next = runSteps(slot.world, n, commands);
    slot.world = next;
    if (commands.length > 0 || next.tick % 5 === 0) writeDb(id, next);
    return structuredClone(next);
  });
}

export async function resetExercise(scenario: ScenarioId, seed: number, role: Role): Promise<World> {
  if (role !== "commander") throw new Error("Commander clearance required. The picture was not changed.");
  const world = makeScenario(scenario, seed);
  const slot = slots().get(scenario) ?? { world, chain: Promise.resolve() };
  slots().set(scenario, slot);
  return enqueue(slot, async () => {
    slot.world = world;
    writeDb(scenario, world);
    return structuredClone(world);
  });
}

export async function health(): Promise<{
  ok: true;
  product: "ODIN°";
  exercise: "DAEMON";
  note: string;
  exercises: string[];
}> {
  return {
    ok: true,
    product: "ODIN°",
    exercise: "DAEMON",
    note: "Simulated exercise. The server owns the picture. Not for operational use. A commander approves every engagement.",
    exercises: [...slots().keys()],
  };
}
