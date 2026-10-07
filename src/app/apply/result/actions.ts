"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { respondToOffer } from "@/lib/game/result";

export async function acceptOfferAction(): Promise<void> {
  const user = await requireUser();
  await respondToOffer(user.id, true);
  redirect("/apply/result");
}

export async function declineOfferAction(): Promise<void> {
  const user = await requireUser();
  await respondToOffer(user.id, false);
  redirect("/apply/result");
}