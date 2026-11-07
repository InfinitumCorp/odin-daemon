import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/odin/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleDaemonRequest } = await import("@/lib/odin/http.server");
        const splat = typeof params._splat === "string" ? params._splat : "";
        return handleDaemonRequest(request, splat);
      },
      POST: async ({ request, params }) => {
        const { handleDaemonRequest } = await import("@/lib/odin/http.server");
        const splat = typeof params._splat === "string" ? params._splat : "";
        return handleDaemonRequest(request, splat);
      },
    },
  },
});
