"use client";

import { useState } from "react";
import { Dices } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type GameCoverSize = "sm" | "md" | "lg" | "card";

const sizeClasses: Record<GameCoverSize, string> = {
  sm: "h-[72px] w-14",
  md: "h-[104px] w-20",
  lg: "h-[210px] w-40",
  card: "aspect-[4/5] w-full",
};

type GameCoverProps = {
  src?: string | null;
  alt: string;
  size?: GameCoverSize;
  loading?: boolean;
  className?: string;
};

export function GameCover({
  src,
  alt,
  size = "md",
  loading = false,
  className,
}: GameCoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasImage = Boolean(src && failedSrc !== src);

  if (loading) {
    return (
      <Skeleton
        className={cn("shrink-0 rounded-lg", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface-elevated)]",
        sizeClasses[size],
        className,
      )}
    >
      {hasImage ? (
        // Remote cover domains are provider-driven, so the native element is intentional.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center text-[10px] leading-tight text-[var(--text-muted)]"
          role="img"
          aria-label={`${alt}: обложка отсутствует`}
        >
          <Dices className="h-1/4 min-h-5 w-1/4 min-w-5" aria-hidden="true" />
          <span className="line-clamp-2">Нет обложки</span>
        </div>
      )}
    </div>
  );
}
