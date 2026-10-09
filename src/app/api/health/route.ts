/**
 * A tiny "are you awake?" page for an uptime monitor. It answers at once without
 * touching the database, and regular visits keep the game's server warm so the first
 * player after a quiet spell does not wait for it to start up.
 */
export function GET() {
  return Response.json({ ok: true, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
