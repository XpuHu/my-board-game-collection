"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type OfflineBannerProps = {
  className?: string;
  forceVisible?: boolean;
};

export function OfflineBanner({
  className,
  forceVisible = false,
}: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateNetworkState = () => setIsOffline(!navigator.onLine);
    updateNetworkState();
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
    };
  }, []);

  if (!forceVisible && !isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex min-h-10 items-center justify-center gap-2 border-b border-warning/30 bg-[var(--warning-soft)] px-4 py-2 text-center text-sm text-warning",
        className,
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Нет подключения. Отображаются сохранённые данные.</span>
    </div>
  );
}
