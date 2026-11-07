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
        "inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium motion-safe:transition-colors disabled:opacity-50",
        tone === "accent" && "bg-accent text-on-accent hover:opacity-90",
        tone === "alert" && "bg-alert text-fg hover:opacity-90",
        tone === "ghost" && "border border-line bg-surface text-fg hover:border-accent",
        className,
      )}
      {...props}
    />
  );
}
