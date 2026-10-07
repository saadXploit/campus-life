"use client";

import { useEffect, useRef } from "react";
import { startAmbient, type AmbientKind } from "@/lib/audio/ambient";

/**
 * Plays the background sound for the current place.
 * Browsers only allow sound after the player taps or presses a key, so it starts then.
 */
export default function AmbientSound({
  kind,
  night,
  muted,
}: {
  kind: AmbientKind;
  night: boolean;
  muted: boolean;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const want = useRef({ kind, night, muted });

  useEffect(() => {
    want.current = { kind, night, muted };
  }, [kind, night, muted]);

  // Create the audio engine on the first tap or key press.
  useEffect(() => {
    function unlock() {
      if (ctxRef.current) return;
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = want.current.muted ? 0 : 0.5;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
      stopRef.current = startAmbient(ctx, master, want.current.kind, want.current.night);
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Change the sound when the place or time of day changes.
  useEffect(() => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    stopRef.current?.();
    stopRef.current = startAmbient(ctx, master, kind, night);
  }, [kind, night]);

  useEffect(() => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.1);
  }, [muted]);

  // Pause when the tab is hidden (saves battery), and clean up when leaving the game.
  useEffect(() => {
    function visibility() {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (document.visibilityState === "hidden") void ctx.suspend();
      else void ctx.resume();
    }
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      stopRef.current?.();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return null;
}
