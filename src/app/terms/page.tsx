import Link from "next/link";
import LegalPage, { Contact } from "@/components/LegalPage";

export const metadata = { title: "Terms of use · Campus Life" };

/** Plain-language terms of use. Review them (or have them reviewed) before launch. */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 2026">
      <p>By signing in and playing Campus Life you agree to these terms.</p>

      <h2>The game</h2>
      <p>
        Campus Life is a work of fiction. All universities, people and events in it are made up. Game money (naira in
        the game) has no value outside the game and can never be exchanged for real money.
      </p>

      <h2>Who can play</h2>
      <p>
        You must be at least 16. Dating features and real-money purchases are only for players aged 18 and over. One
        person may keep more than one sign-in, but must not use extra accounts to cheat or to get around a ban.
      </p>

      <h2>Be decent</h2>
      <ul>
        <li>No harassment, threats, hate speech, sexual content involving minors, or sharing other people&apos;s personal details.</li>
        <li>No cheating, exploiting bugs, automated play, or trying to break into the game or other accounts.</li>
        <li>No scams, including asking for real money or offering to buy or sell accounts or game money.</li>
        <li>Respect &quot;no&quot;. Dating in the game needs both players&apos; consent.</li>
      </ul>
      <p>
        Moderators may remove content, mute, suspend or ban accounts that break these rules. Use Block and Report in
        the game if someone bothers you.
      </p>

      <h2>Purchases</h2>
      <p>
        When the shop takes real money, purchases are handled by Paystack and follow our{" "}
        <Link href="/refunds" className="text-amber-300 underline">
          shop and refund policy
        </Link>
        .
      </p>

      <h2>Changes and availability</h2>
      <p>
        The game is being built and will change. We may add, change or remove features, rebalance prices and pay, or
        pause the game for maintenance. We do our best to keep it running but cannot promise it will always be
        available.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Contact />.
      </p>
    </LegalPage>
  );
}
