"use client";

import { motion } from "framer-motion";

export default function Meter({
  label,
  icon,
  value,
  color,
}: {
  label: string;
  icon: string;
  value: number;
  color: string;
}) {
  const low = value < 25;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          {icon} {label}
        </span>
        <span className={low ? "font-bold text-red-300" : "text-zinc-300"}>
          {value}%{low ? " · Low" : ""}
        </span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: low ? "#f87171" : color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}