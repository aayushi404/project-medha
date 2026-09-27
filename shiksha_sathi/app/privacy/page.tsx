import type { Metadata } from "next";
import Link from "next/link";

import { CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · Medha",
  description: "What data Medha collects, why, and who it is shared with.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="25 September 2026"
      hindiSummary="मेधा शिक्षकों, छात्रों और प्रधानाचार्यों के लिए है। हम केवल वही जानकारी रखते हैं जो ऐप चलाने के लिए ज़रूरी है — जैसे नाम, ईमेल, उपस्थिति और अंक। हम आपका डेटा बेचते नहीं हैं और विज्ञापन नहीं दिखाते। अपना खाता और डेटा हटवाने के लिए हमें ईमेल करें।"
    >
      <p>
        Medha (&ldquo;we&rdquo;) is an AI teaching assistant for schools in Bihar, available at
        www.projectmedha.online and as an app on Google Play and the Microsoft Store. This policy
        explains what we collect, why, and who we share it with.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — name, email, password (stored only as a secure hash),
          phone number if you add one, role (student, teacher or principal), school, and preferred
          language. If you sign in with Google, we receive your Google account ID, name and email.
        </li>
        <li>
          <strong>Teacher profile</strong> — employee code, qualification and years of experience,
          if provided.
        </li>
        <li>
          <strong>Student school records</strong> entered by teachers — name, class, roll and
          admission number, guardian name, relation and phone number, attendance, marks and
          remarks, and fee payments.
        </li>
        <li>
          <strong>What you create or ask</strong> — questions to the assistant, chat history,
          lesson plans, quizzes, notes and other generated material.
        </li>
        <li>
          <strong>Voice</strong> — when you use a voice feature, your audio is sent for speech
          recognition and the resulting text transcript is saved with your conversation. We do not
          store the audio recording.
        </li>
        <li>
          <strong>Answer sheets</strong> — photos or PDFs of OMR answer sheets a teacher uploads
          are read on our server to calculate marks. We keep the marks, not the uploaded file.
        </li>
        <li>
          <strong>Absence calls</strong> — if a school turns on automated absence calls, we call
          the guardian&rsquo;s phone number and store the call status and a text transcript of the
          call.
        </li>
        <li>
          <strong>Device and sign-in data</strong> — basic device information for your signed-in
          sessions, and a notification token if you allow notifications.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the app: signing you in, showing your classes, attendance, report cards and fees.</li>
        <li>To generate teaching material and answer questions with AI.</li>
        <li>To send notifications you have allowed, and absence calls a school has turned on.</li>
        <li>To keep the service secure and prevent abuse (for example, rate limits).</li>
      </ul>
      <p>
        We do not sell personal data, and we do not use it for advertising. The app shows no ads.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We share data only with service providers that process it on our behalf to run Medha:
      </p>
      <ul>
        <li>
          <strong>AI providers</strong> (Google Gemini, Anthropic Claude, Voyage AI) — the text of
          your questions and the material being generated.
        </li>
        <li>
          <strong>Speech provider</strong> (Sarvam AI) — voice audio for speech-to-text, and text for
          text-to-speech.
        </li>
        <li>
          <strong>Telephony providers</strong> (Twilio or Exotel) — guardian phone numbers and call
          audio, only for absence calls.
        </li>
        <li>
          <strong>Google</strong> — Google Sign-In, and Firebase Cloud Messaging for notifications.
        </li>
        <li>
          <strong>Hosting</strong> — our web host, database and file-storage providers.
        </li>
      </ul>
      <p>
        Inside a school, teachers and the principal can see the records of students in their
        school. We may disclose data if required by law.
      </p>

      <h2>Security and retention</h2>
      <p>
        Data is encrypted in transit (HTTPS). Passwords are stored only as hashes. We keep data
        while your account or your school&rsquo;s use of Medha is active, and delete it when you
        ask us to (see below), except where we must keep it by law.
      </p>

      <h2>Children</h2>
      <p>
        Student accounts and records are created and managed by schools and their teachers for
        educational use. If you are a parent or guardian and want to review or delete a
        child&rsquo;s data, contact us or the child&rsquo;s school.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us for a copy of your data, to correct it, or to delete your account. See{" "}
        <Link href="/delete-account">Delete your account</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If we change this policy,
        we will update the date above.
      </p>
    </LegalPage>
  );
}
