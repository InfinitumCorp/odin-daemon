import assert from "node:assert/strict";
import test from "node:test";
import { picture, resetExercise, stepExercise } from "./service.server.ts";

test("the server keeps the picture across steps", async () => {
  await resetExercise("gallery", 9, "commander");
  const first = await stepExercise("gallery", "observer", 1, []);
  const second = await stepExercise("gallery", "analyst", 2, []);
  assert.equal(second.tick, first.tick + 2);
  const joined = await picture("gallery");
  assert.equal(joined.tick, second.tick);
  assert.equal(joined.record, second.record);
});

test("an observer cannot approve a shot", async () => {
  const world = await resetExercise("harbor", 4, "commander");
  await assert.rejects(
    () => stepExercise("harbor", "observer", 1, [{ type: "approve", engagementId: "nope" }]),
    /Commander clearance/,
  );
  const still = await picture("harbor");
  assert.equal(still.tick, world.tick);
});
