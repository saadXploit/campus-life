import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAdAction } from "../actions";

const ERRORS: Record<string, string> = {
  invalid: "Please check the form. Links must start with https://, colours look like #112233.",
  dates: "The end must be after the start.",
  failed: "That could not be saved. Nothing was changed.",
};

/** ISO time to the "2026-10-09T08:00" a date-time box expects, in Lagos time. */
function toLagosInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(Date.parse(iso) + 3600_000).toISOString().slice(0, 16);
}

type Ad = {
  id: string;
  placement: string;
  title: string;
  advertiser: string;
  headline: string;
  subline: string | null;
  price_text: string | null;
  bg_color: string;
  fg_color: string;
  destination_url: string | null;
  university_id: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  weight: number;
};

const BLANK: Ad = {
  id: "new",
  placement: "billboard",
  title: "",
  advertiser: "",
  headline: "",
  subline: null,
  price_text: null,
  bg_color: "#111827",
  fg_color: "#ffffff",
  destination_url: null,
  university_id: null,
  status: "draft",
  starts_at: null,
  ends_at: null,
  weight: 1,
};

export default async function EditAdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff("ADMIN");
  const { id } = await params;
  const { error } = await searchParams;
  if (id !== "new" && !/^[0-9a-f-]{36}$/.test(id)) notFound();

  const admin = createAdminClient();
  let ad = BLANK;
  if (id !== "new") {
    const { data } = await admin.from("ads").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    ad = data as Ad;
  }
  const { data: universities } = await admin.from("universities").select("id, name").order("name");

  const field =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-red-400";

  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin/ads" className="text-sm text-zinc-400 hover:text-white">
          Back to ads
        </Link>
        <h1 className="mt-6 text-3xl font-extrabold">{id === "new" ? "New ad" : "Edit ad"}</h1>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {ERRORS[error] ?? ERRORS.failed}
          </p>
        )}

        <form action={saveAdAction} className="mt-6 space-y-5">
          <input type="hidden" name="id" value={ad.id} />

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="block text-sm text-zinc-300">
              Where it shows
              <select name="placement" defaultValue={ad.placement} className={field}>
                <option value="billboard">🪧 Billboard on campus</option>
                <option value="club_song">🎵 Song on the club screen</option>
                <option value="market_product">🛒 Product at the market</option>
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Internal name (staff only)
                <input name="title" required minLength={2} maxLength={60} defaultValue={ad.title} className={field} />
              </label>
              <label className="block text-sm text-zinc-300">
                Advertiser
                <input name="advertiser" required minLength={2} maxLength={60} defaultValue={ad.advertiser} className={field} />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-bold">What players see</h2>
            <label className="block text-sm text-zinc-300">
              Headline (billboard text, song title or product name)
              <input name="headline" required minLength={2} maxLength={40} defaultValue={ad.headline} className={field} />
            </label>
            <label className="block text-sm text-zinc-300">
              Second line (tagline, artist or product line) — optional
              <input name="subline" maxLength={60} defaultValue={ad.subline ?? ""} className={field} />
            </label>
            <label className="block text-sm text-zinc-300">
              Price text (products only, e.g. ₦1,500) — optional
              <input name="price_text" maxLength={20} defaultValue={ad.price_text ?? ""} className={field} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm text-zinc-300">
                Background
                <input name="bg_color" type="color" defaultValue={ad.bg_color} className={field + " h-11 p-1"} />
              </label>
              <label className="block text-sm text-zinc-300">
                Text colour
                <input name="fg_color" type="color" defaultValue={ad.fg_color} className={field + " h-11 p-1"} />
              </label>
            </div>
            <label className="block text-sm text-zinc-300">
              Link (https only) — optional
              <input
                name="destination_url"
                type="url"
                maxLength={500}
                placeholder="https://"
                defaultValue={ad.destination_url ?? ""}
                className={field}
              />
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-bold">When and where</h2>
            <label className="block text-sm text-zinc-300">
              Campus
              <select name="university_id" defaultValue={ad.university_id ?? ""} className={field}>
                <option value="">Every campus</option>
                {(universities ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Starts (Lagos time) — optional
                <input name="starts_at" type="datetime-local" defaultValue={toLagosInput(ad.starts_at)} className={field} />
              </label>
              <label className="block text-sm text-zinc-300">
                Ends (Lagos time) — optional
                <input name="ends_at" type="datetime-local" defaultValue={toLagosInput(ad.ends_at)} className={field} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm text-zinc-300">
                Status
                <select name="status" defaultValue={ad.status} className={field}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="block text-sm text-zinc-300">
                Priority (1-100)
                <input name="weight" type="number" min={1} max={100} defaultValue={ad.weight} className={field} />
              </label>
            </div>
          </section>

          <button type="submit" className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-bold">
            Save ad
          </button>
        </form>
      </div>
    </main>
  );
}
