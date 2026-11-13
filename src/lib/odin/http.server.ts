import { currentGeoNote, peerFromRequest } from "../geo/hook.server.ts";
import type { GeoNote } from "../geo/hook.ts";
import {
  asRole,
  asScenario,
  health,
  picture,
  resetExercise,
  stepExercise,
} from "./service.server.ts";
import type { Command, Roe } from "./types.ts";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function commandsOf(value: unknown): Command[] {
  if (!Array.isArray(value)) return [];
  const out: Command[] = [];
  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const command = item as Command;
    if (
      (command.type === "approve" || command.type === "deny") &&
      typeof command.engagementId === "string"
    ) {
      out.push(command);
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

/** HTTP contract. The body never contains a world. The server is the picture. */
export async function handleDaemonRequest(request: Request, splat: string): Promise<Response> {
  const path = splat.replace(/^\/+|\/+$/g, "");
  const url = new URL(request.url);
  let geo: GeoNote | null = null;
  try {
    geo = await currentGeoNote(peerFromRequest(request));
  } catch {
    geo = null;
  }
  const send = (body: object, status = 200) => json(geo ? { ...body, geo } : body, status);
  try {
    if (request.method === "GET" && (path === "health" || path === "")) {
      return send({ ...(await health()) });
    }
    if (request.method === "GET" && path === "picture") {
      const role = asRole(url.searchParams.get("role"));
      const exercise = asScenario(url.searchParams.get("exercise"));
      const world = await picture(exercise);
      return send({ ok: true, role, exercise, world });
    }
    if (request.method !== "POST") return send({ ok: false, error: "Not found." }, 404);
    const body = (await request.json().catch(() => ({}))) as {
      role?: unknown;
      exercise?: unknown;
      scenario?: unknown;
      seed?: unknown;
      steps?: unknown;
      commands?: unknown;
    };
    const role = asRole(body.role);
    if (path === "step") {
      const exercise = asScenario(body.exercise);
      const steps = Number.isFinite(body.steps) ? Math.floor(body.steps as number) : 1;
      const world = await stepExercise(exercise, role, steps, commandsOf(body.commands));
      return send({ ok: true, role, exercise, world });
    }
    if (path === "reset") {
      const scenario = asScenario(body.scenario ?? body.exercise);
      const seed = Number.isFinite(body.seed) ? Math.floor(body.seed as number) : 1107;
      const world = await resetExercise(scenario, seed, role);
      return send({ ok: true, role, exercise: scenario, world });
    }
    return send({ ok: false, error: "Not found." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The exercise backend failed.";
    const status = message.startsWith("Commander clearance") ? 403 : 500;
    return send({ ok: false, error: message }, status);
  }
}
