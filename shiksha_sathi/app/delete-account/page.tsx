import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Delete your account · Medha",
  description: "How to delete your Medha account and data.",
};

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Delete my Medha account",
)}&body=${encodeURIComponent(
  "Please delete my Medha account.\n\nEmail I sign in with: \nRole (student / teacher / principal): \nSchool: ",
)}`;

export default function DeleteAccountPage() {
  return (
    <LegalPage
      title="Delete your Medha account"
      updated="25 September 2026"
      hindiSummary="अपना मेधा खाता और उससे जुड़ा डेटा हटवाने के लिए, जिस ईमेल से आप लॉग इन करते हैं उसी से हमें ईमेल करें। हम 30 दिनों के अंदर खाता हटा देंगे।"
    >
      <h2>How to request deletion</h2>
      <ul>
        <li>
          Email <a href={MAILTO}>{CONTACT_EMAIL}</a> from the email address you sign in with,
          with the subject &ldquo;Delete my Medha account&rdquo;.
        </li>
        <li>Tell us your role (student, teacher or principal) and your school.</li>
        <li>
          We may reply to confirm it&rsquo;s you. We delete the account within 30 days and email
          you when it&rsquo;s done.
        </li>
      </ul>
      <p>
        <a
          href={MAILTO}
          className="inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground no-underline!"
        >
          Email a deletion request
        </a>
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your account: name, email, phone number, password hash and Google sign-in link.</li>
        <li>Your chats, questions, voice transcripts and generated material.</li>
        <li>Your sign-in sessions and notification tokens.</li>
      </ul>

      <h2>What may be kept</h2>
      <p>
        Student records a school created (attendance, marks, fees) belong to the school&rsquo;s
        records. If a teacher leaves, those records stay with the school, but are no longer linked
        to the teacher&rsquo;s name. A student or guardian who wants their school records removed
        should also contact the school. We keep anything the law requires us to keep, and nothing
        else.
      </p>

      <p>
        More details are in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
