# Medha — store launch kit

Everything to copy-paste into Google Play Console and Microsoft Partner Center.
Images are in this folder. The Android app project is in `android-twa/`.

## Links

| What | Link |
| --- | --- |
| Website / app | https://project-medha.vercel.app |
| Privacy policy | https://project-medha.vercel.app/privacy |
| Account deletion | https://project-medha.vercel.app/delete-account |
| Contact email | homeofirstt@gmail.com |

## Store listing text

**App name** (max 30): `Medha: AI Teaching Co-pilot`

**Short description** (max 80):
`AI lesson plans, quizzes, attendance & report cards for Bihar's teachers.`

**Full description:**

```
Medha is an AI teaching co-pilot built for government school teachers, students and principals in Bihar — in Hindi and English.

FOR TEACHERS
• Lesson plans, question papers, quizzes, notes and presentations in seconds, matched to your class, subject and chapter
• Ask the AI assistant anything about a topic — by typing or by voice, in Hindi or English
• Mark attendance, and let Medha call guardians of absent students automatically (when your school turns it on)
• Enter marks and generate report cards
• Homework, timetable and fee records in one place

FOR STUDENTS
• Practice quizzes, notes, a digital library and interactive science simulations
• Spoken English practice with pronunciation feedback

FOR PRINCIPALS
• Approve teachers, see your school's students and staff at a glance

Built for low-cost phones and patchy networks. No ads.
```

**Category:** Education · **Tags:** Education, Teaching, Productivity

**Graphics:**
- App icon 512×512 → `app-icon-512.png`
- Feature graphic 1024×500 → `feature-graphic-1024x500.png`
- Phone screenshots (at least 2): take them yourself on a phone while signed in — dashboard, a generated lesson plan, attendance, report card work well.

## Play Console → App content

**Privacy policy:** `https://project-medha.vercel.app/privacy`

**App access:** "All or some functionality is restricted" → add a working demo
teacher login (e.g. one from `backend/scripts/seed_demo_accounts.py`, if it
exists on the production database — test it first). Reviewers can't get past
the login screen without this, and it's the most common rejection reason.

**Ads:** No, the app does not contain ads.

**Target audience:** your decision. Students use Medha, so if you tick any age
group under 13, Google's Families Policy applies (stricter rules for AI
features and data). If students on Medha are class 8 and up, choosing
13–17 and 18+ avoids that. Teachers/principals are 18+.

**Content rating:** fill the questionnaire honestly; category "Reference, News,
or Educational". No violence, no gambling, no purchases. Users interact with an
AI assistant; users do not message each other publicly.

### Data safety answers

- Does your app collect or share user data? **Yes**
- Is all data encrypted in transit? **Yes** (HTTPS)
- Can users request data deletion? **Yes** → `https://project-medha.vercel.app/delete-account`
- Data "shared" with third parties? **No** — Gemini, Claude, Sarvam, Twilio/Exotel,
  Firebase etc. act as *service providers* for Medha, which Google does not count as sharing.

| Data type (Play's name) | Collected | Why (purpose) | Optional? |
| --- | --- | --- | --- |
| Personal info → Name | Yes | App functionality, Account management | Required |
| Personal info → Email address | Yes | App functionality, Account management | Required |
| Personal info → User IDs | Yes | Account management | Required |
| Personal info → Phone number | Yes | App functionality (guardian numbers for absence calls; teacher phone) | Optional |
| Personal info → Other info | Yes | App functionality (school, role, class, roll no., guardian name) | Required |
| Audio → Voice or sound recordings | Yes, **processed ephemerally** (not stored) | App functionality (voice questions) | Optional |
| App activity → Other user-generated content | Yes | App functionality (questions, chats, generated material) | Required |
| App activity → Other actions | Yes | App functionality (attendance, marks, fee entries) | Required |
| Device or other IDs | Yes | App functionality (notification token) | Optional |

Not collected: location, contacts, photos/videos, files, calendar, health,
financial/payment info, web browsing, analytics/crash logs.

## Microsoft Store (Partner Center)

1. Apps and games → **New product → MSIX or PWA app** → reserve "Medha".
2. Product management → **Product Identity** → copy *Package ID*, *Publisher ID*,
   *Publisher display name*.
3. Go to https://www.pwabuilder.com → enter `https://project-medha.vercel.app` →
   **Package for stores → Windows** → paste the three values → download the zip.
4. Start a submission → upload the `.msixbundle` **and** `.classic.appxbundle`
   from the zip. Reuse the texts, privacy link and images above (Windows needs
   at least one desktop screenshot, 1366×768 or larger).

Web code changes go live in the Windows app without resubmitting; only changes
to the app's name, icons or manifest need a new package.
