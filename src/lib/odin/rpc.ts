import { createServerFn } from "@tanstack/react-start";
import type { Command, Roe, Role, ScenarioId, Trace, World } from "./types.ts";

function asRole(value: unknown): Role {
  if (value === "observer" || value === "analyst" || value === "commander") return value;
  return "commander";
}

function asCommands(value: unknown): Command[] {
  if (!Array.isArray(value)) return [];
  const out: Command[] = [];
  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const command = item as Command;
    if (command.type === "approve" || command.type === "deny") {
      if (typeof command.engagementId === "string") out.push(command);
    } else if (command.type === "launch" && typeof command.assetId === "string") {
      out.push(command);
    } else if (command.type === "adopt" && typeof command.coaId === "string") {
      out.push(command);
    } else if (command.type === "roe" && (command.roe === "HOLD" || command.roe === "TIGHT")) {
      out.push({ type: "roe", roe: command.roe satisfies Roe });
    }
  }
  return out;
}

export const bootstrapSim = createServerFn({ method: "POST" })
  .validator((data: { scenario?: ScenarioId; seed?: number; role?: Role }) => {
    const scenario: ScenarioId =
      data?.scenario === "harbor" || data?.scenario === "gallery" ? data.scenario : "hearth";
    const seed = Number.isFinite(data?.seed) ? Math.floor(data!.seed as number) : 1107;
    return { scenario, seed, role: asRole(data?.role) };
  })
  .handler(async ({ data }): Promise<{ world: World; trace: Trace }> => {
    const started = performance.now();
    const { picture, resetExercise } = await import("./service.server.ts");
    const world =
      data.role === "commander" && data.seed !== 1107
        ? await resetExercise(data.scenario, data.seed, data.role)
        : await picture(data.scenario);
    const { withGeoTrace } = await import("../geo/hook.server.ts");
    return {
      world,
      trace: await withGeoTrace({
        fn: "odin.picture",
        ms: performance.now() - started,
        bytesIn: 0,
        bytesOut: JSON.stringify(world).length,
      }),
    };
  });

export const resetSim = createServerFn({ method: "POST" })
  .validator((data: { scenario?: ScenarioId; seed?: number; role?: Role }) => {
    const scenario: ScenarioId =
      data?.scenario === "harbor" || data?.scenario === "gallery" ? data.scenario : "hearth";
    const seed = Number.isFinite(data?.seed) ? Math.floor(data!.seed as number) : 1107;
    return { scenario, seed, role: asRole(data?.role) };
  })
  .handler(async ({ data }): Promise<{ world: World; trace: Trace }> => {
    const started = performance.now();
    const { resetExercise } = await import("./service.server.ts");
    const world = await resetExercise(data.scenario, data.seed, data.role);
    const { withGeoTrace } = await import("../geo/hook.server.ts");
    return {
      world,
      trace: await withGeoTrace({
        fn: "odin.reset",
        ms: performance.now() - started,
        bytesIn: 0,
        bytesOut: JSON.stringify(world).length,
      }),
    };
  });

export const stepSim = createServerFn({ method: "POST" })
  .validator((data: { exercise?: ScenarioId; steps?: number; commands?: unknown; role?: Role }) => {
    const exercise: ScenarioId =
      data?.exercise === "harbor" || data?.exercise === "gallery" ? data.exercise : "hearth";
    const steps = Math.max(1, Math.min(12, Math.floor(data?.steps ?? 1)));
    return { exercise, steps, commands: asCommands(data?.commands), role: asRole(data?.role) };
  })
  .handler(async ({ data }): Promise<{ world: World; trace: Trace }> => {
    const started = performance.now();
    const { stepExercise } = await import("./service.server.ts");
    const world = await stepExercise(data.exercise, data.role, data.steps, data.commands);
    const { withGeoTrace } = await import("../geo/hook.server.ts");
    return {
      world,
      trace: await withGeoTrace({
        fn: "odin.step",
        ms: performance.now() - started,
        bytesIn: JSON.stringify(data.commands).length,
        bytesOut: JSON.stringify(world).length,
      }),
    };
  });
