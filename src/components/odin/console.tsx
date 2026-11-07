import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { MODULES, PROVENANCE } from "@/lib/odin/catalog";
import { forecastFor } from "@/lib/odin/conjure";
import { airframe } from "@/lib/odin/models/index";
import { resetSim, stepSim } from "@/lib/odin/rpc";
import type { Command, Role, ScenarioId, Trace, World } from "@/lib/odin/types";
import { Button } from "@/components/ui/button";
import { Plot } from "./plot";

const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: "hearth", label: "Hearth" },
  { id: "harbor", label: "Harbor" },
  { id: "gallery", label: "Gallery" },
];

function clock(tick: number): string {
  const s = Math.floor(tick);
  const m = Math.floor(s / 60);
  return `T+${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function Console({ initial }: { initial: { world: World; trace: Trace } }) {
  const step = useServerFn(stepSim);
  const reset = useServerFn(resetSim);
  const [world, setWorld] = useState(initial.world);
  const [traces, setTraces] = useState<Trace[]>([initial.trace]);
  const [running, setRunning] = useState(true);
  const [pace, setPace] = useState(4);
  const [whiteCell, setWhiteCell] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("commander");
  const [tab, setTab] = useState<"log" | "coa" | "conjure" | "rpc" | "stack">("log");
  const [error, setError] = useState<string | null>(null);
  const roleRef = useRef(role);
  const worldRef = useRef(world);
  const queue = useRef<Command[]>([]);
  const busy = useRef(false);
  const paceRef = useRef(pace);
  worldRef.current = world;
  roleRef.current = role;
  paceRef.current = pace;

  const beat = async (steps?: number) => {
    if (busy.current) return;
    busy.current = true;
    const commands = queue.current.splice(0, queue.current.length);
    try {
      const result = await step({
        data: {
          exercise: worldRef.current.scenario,
          steps: steps ?? paceRef.current,
          commands,
          role: roleRef.current,
        },
      });
      worldRef.current = result.world;
      setWorld(result.world);
      setTraces((prev) => [result.trace, ...prev].slice(0, 10));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Step failed");
      if (commands.length > 0) setRunning(false);
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => void beat(), 800);
    return () => window.clearInterval(id);
    // beat closes over refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const send = (command: Command) => {
    queue.current.push(command);
    void beat(1);
  };

  const load = async (scenario: ScenarioId) => {
    setRunning(false);
    try {
      const result = await reset({ data: { scenario, seed: 1107, role: roleRef.current } });
      worldRef.current = result.world;
      setWorld(result.world);
      setTraces([result.trace]);
      setSelected(null);
      setError(null);
      setRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scenario failed");
    }
  };

  const pending = world.engagements.filter((e) => e.state === "pending");
  const committed = world.engagements.filter((e) => e.state === "approved");
  const selectedAsset = world.assets.find((a) => a.id === selected);
  const selectedTrack = world.tracks.find((t) => t.id === selected);
  const docked = world.assets.filter((a) => a.status === "docked").length;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-40">
          <p className="text-[15px] font-medium tracking-normal text-fg">
            ODIN°<sup className="text-[0.6em]">™</sup>
          </p>
          <h1 className="text-base font-normal leading-snug text-muted">DAEMON exercise</h1>
        </div>
        <p className="max-w-xl text-sm text-muted">
          {world.title}. The server holds the picture. A commander approves every engagement.
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {SCENARIOS.map((scenario) => (
            <Button
              key={scenario.id}
              tone={world.scenario === scenario.id ? "ink" : "ghost"}
              onClick={() => void load(scenario.id)}
            >
              {scenario.label}
            </Button>
          ))}
          {(["observer", "analyst", "commander"] as const).map((name) => (
            <Button key={name} tone={role === name ? "ink" : "ghost"} onClick={() => setRole(name)}>
              {name}
            </Button>
          ))}
          <Button tone="ghost" onClick={() => setRunning((v) => !v)}>
            {running ? "Pause" : "Run"}
          </Button>
          <Button tone="ghost" onClick={() => setPace((p) => (p === 4 ? 8 : 4))}>
            {pace === 4 ? "Pace 4s" : "Pace 8s"}
          </Button>
        </div>
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[16rem_minmax(0,1fr)_22rem]">
        <section className="border-b border-line lg:overflow-auto lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-xs text-muted">Blue air</h2>
            <span className="font-mono text-xs text-muted">{docked} docked</span>
          </div>
          <ul>
            {world.assets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => setSelected(asset.id)}
                  className={
                    "flex w-full flex-col gap-1 border-t border-line px-4 py-2 text-left " +
                    (selected === asset.id ? "bg-surface" : "")
                  }
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{asset.callsign}</span>
                    <span className="font-mono text-xs text-muted">{asset.klass}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {asset.status} · link {Math.round(asset.link * 100)}% · bat {Math.round(asset.battery * 100)}%
                  </span>
                  <span className="h-1 overflow-hidden rounded-md bg-line">
                    <span
                      className="block h-full bg-fg"
                      style={{ width: `${Math.round(asset.battery * 100)}%` }}
                    />
                  </span>
                </button>
                {asset.status === "docked" ? (
                  <div className="px-4 pb-2">
                    <Button
                      tone="ghost"
                      disabled={role !== "commander"}
                      onClick={() => send({ type: "launch", assetId: asset.id })}
                    >
                      Launch
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col border-b border-line lg:border-r lg:border-b-0">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2">
            <span className="font-mono text-xs text-fg">{clock(world.tick)}</span>
            <span className="font-mono text-xs text-muted">ROE {world.roe}</span>
            <span className="font-mono text-xs text-muted">hash {world.record.toString(16)}</span>
            <Button
              tone={world.roe === "HOLD" ? "ink" : "ghost"}
              disabled={role !== "commander"}
              onClick={() => send({ type: "roe", roe: world.roe === "HOLD" ? "TIGHT" : "HOLD" })}
            >
              {world.roe === "HOLD" ? "Release to TIGHT" : "Weapons HOLD"}
            </Button>
            <Button tone={whiteCell ? "ink" : "ghost"} onClick={() => setWhiteCell((v) => !v)}>
              {whiteCell ? "White cell on" : "White cell"}
            </Button>
          </div>
          <Plot world={world} whiteCell={whiteCell} selected={selected} onSelect={setSelected} />
          {selectedAsset ? (
            <p className="border-t border-line px-4 py-2 font-mono text-xs text-muted">
              {selectedAsset.callsign} · {airframe(selectedAsset.klass).klass} backend · {airframe(selectedAsset.klass).role} ·{" "}
              {Math.round(selectedAsset.pos.x)} {Math.round(selectedAsset.pos.y)} alt {selectedAsset.alt}m ·{" "}
              {selectedAsset.task ? `${selectedAsset.task.kind}` : "no task"}
              {forecastFor(world, selectedAsset.klass)
                ? ` · CONJURE oppose ${Math.round(forecastFor(world, selectedAsset.klass)!.oppose * 100)}% · ${forecastFor(world, selectedAsset.klass)!.resistant}`
                : ""}
            </p>
          ) : null}
          {selectedTrack ? (
            <p className="border-t border-line px-4 py-2 font-mono text-xs text-muted">
              {selectedTrack.id} {selectedTrack.klass} conf {Math.round(selectedTrack.confidence * 100)}% cov {Math.round(selectedTrack.cov)} ·{" "}
              {selectedTrack.sensors.join(", ") || "coasting"}
            </p>
          ) : null}
        </section>

        <section className="lg:overflow-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-xs text-muted">Approval queue</h2>
            <span className="font-mono text-xs text-alert">{pending.length}</span>
          </div>
          {pending.length === 0 && committed.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">No shot is waiting. AZRAIL does not close unless you approve one.</p>
          ) : (
            <ul className="flex flex-col gap-3 px-4 pb-4">
              {committed.map((engagement) => (
                <li key={engagement.id} className="rounded-md border border-line bg-surface p-3">
                  <p className="text-sm font-medium">
                    {engagement.shooterId} closing on {engagement.trackId}
                  </p>
                  <p className="mt-1 text-sm text-muted">Approved. Resolves only inside the bubble, and only while ROE is TIGHT.</p>
                </li>
              ))}
              {pending.map((engagement) => (
                <li key={engagement.id} className="rounded-md border border-line bg-surface p-3">
                  <p className="text-sm font-medium">
                    {engagement.shooterId} → {engagement.trackId}
                  </p>
                  <p className="mt-1 text-sm text-muted">{engagement.reason}</p>
                  <p className="mt-1 font-mono text-xs text-muted">Pk {Math.round(engagement.pk * 100)}% · {engagement.id}</p>
                  {(() => {
                    const shooter = world.assets.find((a) => a.id === engagement.shooterId);
                    const forecast = shooter ? forecastFor(world, shooter.klass) : undefined;
                    if (!forecast) return null;
                    return (
                      <p className="mt-1 text-sm text-muted">
                        CONJURE {forecast.confidence} · oppose {Math.round(forecast.oppose * 100)}% · {forecast.resistant}. {forecast.adjustment}
                      </p>
                    );
                  })()}
                  <div className="mt-3 flex gap-2">
                    <Button
                      tone="ink"
                      disabled={role !== "commander"}
                      onClick={() => send({ type: "approve", engagementId: engagement.id })}
                    >
                      Approve
                    </Button>
                    <Button
                      tone="ghost"
                      disabled={role !== "commander"}
                      onClick={() => send({ type: "deny", engagementId: engagement.id })}
                    >
                      Deny
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h2 className="border-t border-line px-4 py-3 text-xs text-muted">Tracks</h2>
          <ul>
            {world.tracks.length === 0 ? (
              <li className="px-4 pb-4 text-sm text-muted">ARGUS has no track yet. Sensors need a few seconds.</li>
            ) : (
              world.tracks.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(track.id)}
                    className="flex w-full items-baseline justify-between gap-2 border-t border-line px-4 py-3 text-left"
                  >
                    <span className={track.hostile ? "text-sm text-alert" : "text-sm"}>{track.id}</span>
                    <span className="font-mono text-xs text-muted">
                      {track.klass} · {Math.round(track.confidence * 100)}%
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="flex h-52 shrink-0 flex-col border-t border-line">
        <div className="flex gap-2 px-3 py-2">
          {(
            [
              ["log", "Flight record"],
              ["coa", "SCALVS"],
              ["conjure", "CONJURE"],
              ["rpc", "Server"],
              ["stack", "Stack"],
            ] as const
          ).map(([id, label]) => (
            <Button key={id} tone={tab === id ? "ink" : "ghost"} onClick={() => setTab(id)}>
              {label}
            </Button>
          ))}
          {error ? <span className="self-center text-sm text-alert">{error}</span> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-3">
          {tab === "log" ? (
            <ul className="font-mono text-xs leading-5">
              {[...world.events].reverse().map((event) => (
                <li key={`${event.hash}-${event.tick}-${event.text}`} className={event.level === "act" || event.level === "warn" ? "text-fg" : "text-muted"}>
                  {String(event.tick).padStart(4, "0")} {event.hash} {event.text}
                </li>
              ))}
            </ul>
          ) : null}
          {tab === "coa" ? (
            <ul className="flex flex-col gap-3">
              {world.coas.map((coa) => (
                <li key={coa.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <p className="text-sm font-medium">{coa.title}</p>
                    <p className="text-sm text-muted">{coa.summary}</p>
                  </div>
                  <Button tone="ghost" disabled={role !== "commander"} onClick={() => send({ type: "adopt", coaId: coa.id })}>
                    Adopt
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {tab === "conjure" ? (
            <ul className="flex flex-col gap-2">
              {world.forecasts.map((forecast) => (
                <li key={forecast.klass}>
                  <p className="text-sm">
                    <span className="font-mono text-xs text-fg">{forecast.klass}</span> oppose {Math.round(forecast.oppose * 100)}% · support{" "}
                    {Math.round(forecast.support * 100)}% · {forecast.confidence}
                  </p>
                  <p className="text-sm text-muted">
                    {forecast.proposition}. Resistant: {forecast.resistant}. {forecast.adjustment}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {tab === "rpc" ? (
            <ul className="font-mono text-xs leading-5 text-muted">
              {traces.map((trace, i) => (
                <li key={`${trace.fn}-${i}`}>
                  POST {trace.fn} {trace.ms.toFixed(1)} ms · in {trace.bytesIn} B · out {trace.bytesOut} B
                </li>
              ))}
              <li className="mt-2 text-fg">odin.bootstrap(scenario, seed) → world</li>
              <li className="text-fg">odin.step(world, steps, commands) → world</li>
            </ul>
          ) : null}
          {tab === "stack" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">{PROVENANCE}</p>
              <ul className="flex flex-col gap-2">
                {MODULES.map((mod) => (
                  <li key={mod.id}>
                    <p className="text-sm">
                      <span className="font-mono text-xs text-fg">{mod.layer}</span> {mod.id}
                    </p>
                    <p className="text-sm text-muted">{mod.role}. {mod.method}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
