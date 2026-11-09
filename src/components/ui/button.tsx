import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  tone = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ghost" | "accent" | "ink" | "alert" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-none px-3 text-sm font-normal motion-safe:transition-colors motion-safe:duration-150 disabled:opacity-50",
        tone === "accent" && "bg-fg text-on-accent hover:bg-accent",
        tone === "ink" && "bg-fg text-on-accent hover:bg-accent",
        tone === "alert" && "bg-fg text-on-accent hover:bg-accent",
        tone === "ghost" && "border border-line bg-bg text-fg hover:border-accent hover:text-accent",
        className,
      )}
      {...props}
    />
  );
}
