import LegalPage, { Contact } from "@/components/LegalPage";

export const metadata = { title: "Privacy policy · Campus Life" };

/** Plain-language privacy policy. Review it (or have it reviewed) before launch. */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 2026">
      <p>
        Campus Life is an online game. This page explains what information we collect when you play, why, and the
        choices you have. We follow the Nigeria Data Protection Act 2023.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Sign-in details</strong> from X or Google: an account ID, and your email address and name if the
          provider shares them. We never see your password.
        </li>
        <li>
          <strong>Your game</strong>: your student (name, age, look), where you go, what you do, your game money,
          results, friends, chats, gifts and reports.
        </li>
        <li>
          <strong>Purchases</strong> (when the shop takes real money): the item, the amount and the payment
          reference. Card details are handled by Paystack and never reach us.
        </li>
        <li>
          <strong>Technical data</strong>: login cookies that keep you signed in, a sound on/off setting stored in
          your browser, and the usual server logs (such as IP addresses) kept by our hosting providers for security.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the game and keep your progress.</li>
        <li>To keep players safe: blocking, reports, moderation and stopping cheating and abuse.</li>
        <li>To process purchases and handle refunds.</li>
        <li>To show in-game adverts. Adverts are counted (views and clicks) without tracking you across other sites.</li>
      </ul>

      <h2>Who else handles it</h2>
      <ul>
        <li>Supabase (our database and sign-in service) and our website host.</li>
        <li>X and Google, when you choose to sign in with them.</li>
        <li>Paystack, only when you make a real-money purchase.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>What other players see</h2>
      <p>
        Other players can see your student&apos;s name, look and what you wear, and, if you share your location,
        where you are on campus. You can hide your location from strangers in the game menu. Private chats are only
        seen by the people in them, and by moderators when a message is reported.
      </p>

      <h2>Keeping and deleting</h2>
      <p>
        We keep your information while your account is active. You can ask us to see, correct or delete your
        information, or to close your account, by contacting <Contact />. Some records (such as payment records and
        moderation logs) may be kept longer where the law or safety requires.
      </p>

      <h2>Age</h2>
      <p>
        You must be at least 16 to play. Dating and real-money purchases are only for players aged 18 and over.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your privacy: <Contact />.
      </p>
    </LegalPage>
  );
}
