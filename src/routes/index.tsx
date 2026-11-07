import { createFileRoute } from "@tanstack/react-router";
import { Console } from "@/components/odin/console";
import { bootstrapSim } from "@/lib/odin/rpc";

export const Route = createFileRoute("/")({
  loader: () => bootstrapSim({ data: { scenario: "hearth", seed: 1107 } }),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <Console initial={initial} />;
}
