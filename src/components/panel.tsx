import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type PanelProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  action?: ReactNode;
};

export function Panel({
  title,
  action,
  children,
  className,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn("rounded-xl border bg-card p-5", className)}
      {...props}
    >
      {title || action ? <PanelHeader title={title} action={action} /> : null}
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  action,
  className,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mb-5 flex items-center justify-between gap-4", className)}
    >
      {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
