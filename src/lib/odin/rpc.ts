import { createServerFn } from "@tanstack/react-start";
import { makeScenario } from "./scenario.ts";
import { runSteps } from "./step.ts";
import type { Command, Roe, ScenarioId, Trace, World } from "./types.ts";

function assertWorld(value: unknown): World {
  if (!value || typeof value !== "object") throw new Error("World payload missing.");
  const world = value as World;
  if (typeof world.tick !== "number" || typeof world.rng !== "number") throw new Error("World tick is invalid.");
  if (!Array.isArray(world.assets) || !Array.isArray(world.contacts) || !Array.isArray(world.tracks)) {
    throw new Error("World lists are invalid.");
  }
  if (world.assets.length > 48 || world.contacts.length > 48 || world.tracks.length > 64) {
    throw new Error("World is larger than this sim allows.");
  }
  return world;
}

function asCommands(value: unknown): Command[] {
  if (!Array.isArray(value)) return [];
  const out: Command[] = [];
  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const command = item as Command;
    if (command.type === "approve" || command.type === "deny") {
      if (typeof command.engagementId === "string") out.push(command);
    } else if (command.type === "launch" || command.type === "adopt") {
      if (command.type === "launch" && typeof command.assetId === "string") out.push(command);
      if (command.type === "adopt" && typeof command.coaId === "string") out.push(command);
    } else if (command.type === "roe" && (command.roe === "HOLD" || command.roe === "TIGHT")) {
      out.push({ type: "roe", roe: command.roe satisfies Roe });
    }
  }
  return out;
}

export const bootstrapSim = createServerFn({ method: "POST" })
  .validator((data: { scenario?: ScenarioId; seed?: number }) => {
    const scenario: ScenarioId =
      data?.scenario === "harbor" || data?.scenario === "gallery" ? data.scenario : "hearth";
    const seed = Number.isFinite(data?.seed) ? Math.floor(data!.seed as number) : 1107;
    return { scenario, seed };
  })
  .handler(async ({ data }): Promise<{ world: World; trace: Trace }> => {
    const started = performance.now();
    const world = makeScenario(data.scenario, data.seed);
    const bytesOut = JSON.stringify(world).length;
    return {
      world,
      trace: { fn: "odin.bootstrap", ms: performance.now() - started, bytesIn: 0, bytesOut },
    };
  });

export const stepSim = createServerFn({ method: "POST" })
  .validator((data: { world?: unknown; steps?: number; commands?: unknown }) => {
    const world = assertWorld(data?.world);
    const steps = Math.max(1, Math.min(12, Math.floor(data?.steps ?? 1)));
    return { world, steps, commands: asCommands(data?.commands) };
  })
  .handler(async ({ data }): Promise<{ world: World; trace: Trace }> => {
    const bytesIn = JSON.stringify(data.world).length;
    const started = performance.now();
    const world = runSteps(data.world, data.steps, data.commands);
    return {
      world,
      trace: {
        fn: "odin.step",
        ms: performance.now() - started,
        bytesIn,
        bytesOut: JSON.stringify(world).length,
      },
    };
  });
