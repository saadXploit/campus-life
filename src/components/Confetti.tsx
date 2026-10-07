"use client";

import { motion } from "framer-motion";

const COLORS = ["#facc15", "#f97316", "#34d399", "#60a5fa", "#e879f9"];

export default function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
          initial={{ y: -40, opacity: 1, rotate: 0 }}
          animate={{ y: "105vh", opacity: [1, 1, 0], rotate: 360 + i * 20 }}
          transition={{ duration: 3 + (i % 5) * 0.4, delay: (i % 7) * 0.2, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}