"use client";
/**
 * src/components/countdown.tsx
 *
 * Animated countdown timer. Client-side display only — DB time is authoritative.
 * Accepts serverNow (ISO string) from the server for calibration.
 */
import { useState, useEffect, useRef } from "react";
import { formatCountdown } from "@/lib/time";

interface CountdownProps {
  closesAt: string;
  serverNow?: string;
  className?: string;
}

export default function Countdown({ closesAt, serverNow, className }: CountdownProps) {
  const closesMs = new Date(closesAt).getTime();
  const offset = serverNow
    ? new Date(serverNow).getTime() - Date.now()
    : 0;

  const getRemainingMs = () => closesMs - (Date.now() + offset);

  const [remaining, setRemaining] = useState(getRemainingMs());
  const [ticked, setTicked] = useState(false);
  const prevRef = useRef(remaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getRemainingMs();
      if (next !== prevRef.current) {
        prevRef.current = next;
        setTicked(true);
        setTimeout(() => setTicked(false), 200);
      }
      setRemaining(next);
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closesAt, serverNow]);

  const isUrgent = remaining > 0 && remaining < 3_600_000; // < 1 hour

  return (
    <span
      suppressHydrationWarning
      className={`font-mono tabular-nums transition-colors ${
        remaining <= 0
          ? "text-white/30"
          : isUrgent
          ? "text-amber-400"
          : "text-brand-300"
      } ${ticked ? "animate-countdown-tick" : ""} ${className ?? ""}`}
    >
      {formatCountdown(remaining)}
    </span>
  );
}
