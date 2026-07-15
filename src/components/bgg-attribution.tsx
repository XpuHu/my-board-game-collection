import { cn } from "@/shared/lib/utils";

type BggAttributionProps = {
  className?: string;
  compact?: boolean;
};

export function BggAttribution({
  className,
  compact = false,
}: BggAttributionProps) {
  return (
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noreferrer"
      aria-label="Powered by BoardGameGeek"
      className={cn(
        "inline-flex w-fit rounded-md transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {/* The supplied BGG artwork is served unchanged from the public folder. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/powered_by_bgg.webp"
        alt="Powered by BGG"
        className={cn("w-auto object-contain", compact ? "h-7" : "h-10")}
      />
    </a>
  );
}
