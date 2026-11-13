import { createServerFn } from "@tanstack/react-start";

/** Read or save the geo-routing toggle. The saved default is off. */
export const geoRoutingPref = createServerFn({ method: "POST" })
  .validator((data: { enabled?: boolean } | undefined) => {
    if (data?.enabled === undefined) return {};
    if (typeof data.enabled !== "boolean") return {};
    return { enabled: data.enabled };
  })
  .handler(async ({ data }) => {
    const settings = await import("./settings.ts");
    const before = await settings.geoRoutingStatus();
    if (typeof data.enabled === "boolean" && !before.locked) {
      await settings.writeGeoRouting(data.enabled);
    }
    const status = await settings.geoRoutingStatus();
    return { ...status, saved: !(typeof data.enabled === "boolean" && before.locked) };
  });
