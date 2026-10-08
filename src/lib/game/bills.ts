/** School fees, rent and room types, as returned by get_bills. */

export type Bill = {
  id: number;
  kind: "tuition" | "rent";
  semester_idx: number;
  accommodation: string | null;
  amount_kobo: number;
  late_fee_kobo: number;
  due_at: string;
  paid_at: string | null;
};

export type RoomType = {
  slug: string;
  name: string;
  description: string;
  comfort: number;
  security: number;
  social: number;
  /** Extra energy from sleep, in percent. */
  sleep_bonus: number;
  rent_kobo: number;
};

export type Bills = {
  semester_idx: number;
  covered_by_admission: boolean;
  next_bills_at: string;
  /** The room type you picked (used for the next unpaid rent bill). */
  chosen: string;
  /** The room you live in this semester. */
  living_in: string;
  rent_overdue: boolean;
  bills: Bill[];
  rooms: RoomType[];
};

/** Unpaid bills, with what each will cost to pay right now. */
export function unpaid(b: Bills | null): { bill: Bill; total: number }[] {
  return (b?.bills ?? [])
    .filter((x) => !x.paid_at)
    .map((bill) => ({ bill, total: Number(bill.amount_kobo) + Number(bill.late_fee_kobo) }));
}

export function billLabel(kind: Bill["kind"]): string {
  return kind === "tuition" ? "School fees" : "Rent";
}
