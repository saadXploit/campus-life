"use client";

import { useEffect, useState } from "react";

export default function Countdown({ target }: { target: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(target).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [target]);

  if (left === null) return <span>...</span>;
  if (left === 0) return <span className="text-emerald-300">The exam hall is open</span>;

  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  return (
    <span className="tabular-nums">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}