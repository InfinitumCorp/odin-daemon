import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  tone = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ghost" | "accent" | "alert" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-normal motion-safe:transition-colors motion-safe:duration-150 disabled:opacity-50",
        tone === "accent" && "bg-accent text-on-accent hover:opacity-90",
        tone === "alert" && "bg-fg text-on-accent hover:opacity-90",
        tone === "ghost" && "border border-line bg-bg text-fg hover:border-accent",
        className,
      )}
      {...props}
    />
  );
}
