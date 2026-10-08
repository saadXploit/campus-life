import Link from "next/link";

export const metadata = { title: "Refund policy · Campus Life" };

/** The refund policy Paystack asks every business to publish. Edit to suit your business. */
export default function RefundsPage() {
  return (
    <main className="min-h-screen bg-[#070a14] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-zinc-300">
        <Link href="/home" className="text-zinc-400 hover:text-white">
          Back to campus
        </Link>
        <h1 className="text-3xl font-extrabold text-white">Shop and refund policy</h1>
        <p>
          The Campus Life shop sells digital items for use inside the game, such as outfits, looks and room
          upgrades. Prices are in Nigerian naira and payments are processed by Paystack.
        </p>
        <h2 className="pt-2 text-lg font-bold text-white">Who can buy</h2>
        <p>Purchases are only for players aged 18 and over.</p>
        <h2 className="pt-2 text-lg font-bold text-white">What you get</h2>
        <p>
          A purchased item is added to your account as soon as the payment is confirmed. Items can only be used in
          the game. They cannot be exchanged for game money or real money, and game money cannot be bought.
        </p>
        <h2 className="pt-2 text-lg font-bold text-white">Refunds</h2>
        <p>
          If you were charged but did not receive your item, or you were charged twice, contact us within 14 days
          with your payment reference (it starts with CL-) and we will deliver the item or refund you. Because items
          are delivered instantly, other purchases are not refundable once delivered, except where the law requires.
        </p>
        <h2 className="pt-2 text-lg font-bold text-white">Account bans</h2>
        <p>Items on accounts banned for breaking the rules are not refunded.</p>
      </div>
    </main>
  );
}
