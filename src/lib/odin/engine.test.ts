import assert from "node:assert/strict";
import test from "node:test";
import { airframe, AIRFRAMES } from "./models/index.ts";
import { makeScenario } from "./scenario.ts";
import { runSteps, stepWorld } from "./step.ts";
import type { Asset, Track, World } from "./types.ts";

test("same seed stays identical across 30 steps", () => {
  let a = makeScenario("hearth", 42);
  let b = makeScenario("hearth", 42);
  for (let i = 0; i < 30; i++) {
    a = stepWorld(a, []);
    b = stepWorld(b, []);
  }
  assert.deepEqual(a, b);
  assert.equal(a.tick, 30);
});

test("step does not mutate the caller's world", () => {
  const world = makeScenario("harbor", 7);
  const before = world.tick;
  stepWorld(world, [{ type: "roe", roe: "TIGHT" }]);
  assert.equal(world.tick, before);
  assert.equal(world.roe, "HOLD");
});

test("HOLD blocks a point-blank approved shot", () => {
  const world = primed();
  const next = stepWorld(world, []);
  const contact = next.contacts.find((c) => c.id === "C-1");
  assert.equal(contact?.alive, true);
  assert.equal(next.engagements[0]?.state, "approved");
});

test("TIGHT can resolve a point-blank approved shot", () => {
  const world = primed();
  world.engagements[0].pk = 1;
  const next = stepWorld(world, [{ type: "roe", roe: "TIGHT" }]);
  const contact = next.contacts.find((c) => c.id === "C-1");
  assert.equal(contact?.alive, false);
  assert.equal(next.engagements[0]?.result, "stopped");
});

test("each model has its own backend", () => {
  const world = makeScenario("hearth", 1);
  const contact = world.contacts[0];
  const cher = world.assets.find((a) => a.klass === "CHERUBIM")!;
  const ser = world.assets.find((a) => a.klass === "SERAPHIM")!;
  const close = airframe("CHERUBIM").sense(cher, contact, 200);
  const wide = airframe("SERAPHIM").sense(ser, contact, 200);
  assert.ok(close && wide);
  assert.notEqual(close.sigma, wide.sigma);
  assert.equal(airframe("AZRAIL").recover, "cap");
  assert.equal(airframe("POLLEN").launchable, true);
  assert.equal(airframe("FLOWER").launchable, false);
  assert.equal(airframe("ORBIS").sense(cher, contact, 500), null);
  assert.equal(Object.keys(AIRFRAMES).length, 8);
});

test("CONJURE rehearses each airframe and does not clear a shot", () => {
  const world = makeScenario("hearth", 42);
  assert.equal(world.forecasts.length, 8);
  const names = world.forecasts.map((f) => f.klass);
  assert.deepEqual(names, Object.keys(AIRFRAMES));
  const az = world.forecasts.find((f) => f.klass === "AZRAIL");
  const pad = world.forecasts.find((f) => f.klass === "FLOWER");
  assert.ok(az && pad);
  assert.notEqual(az.proposition, pad.proposition);
  assert.equal(world.engagements.every((e) => e.state !== "approved"), true);
  const again = makeScenario("hearth", 42);
  assert.deepEqual(world.forecasts, again.forecasts);
});

test("sensors eventually birth a track", () => {
  const world = runSteps(makeScenario("hearth", 1107), 12, []);
  assert.ok(world.tracks.length > 0);
});

function primed(): World {
  const world = makeScenario("gallery", 3);
  const shooter = world.assets.find((a) => a.klass === "AZRAIL") as Asset;
  const contact = world.contacts[0];
  contact.alive = true;
  contact.pos = { x: shooter.pos.x + 80, y: shooter.pos.y };
  contact.vel = { x: 0, y: 0 };
  shooter.link = 1;
  shooter.status = "airborne";
  const track: Track = {
    id: "T-TEST",
    pos: { ...contact.pos },
    vel: { x: 0, y: 0 },
    cov: 30,
    klass: "rotor",
    confidence: 0.9,
    hostile: true,
    last: world.tick,
    sensors: [shooter.id],
  };
  world.tracks = [track];
  world.engagements = [
    {
      id: "E-TEST",
      shooterId: shooter.id,
      trackId: track.id,
      state: "approved",
      pk: 1,
      reason: "test",
    },
  ];
  world.roe = "HOLD";
  return world;
}
