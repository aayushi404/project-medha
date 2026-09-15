I want to build a new teacher tool that combines our existing AI quiz-generation functionality with our Random Picker functionality.

The feature is essentially a LIVE CLASSROOM QUIZ.

A teacher selects a class, subject and chapter, generates a quiz, reviews/edits the generated questions, selects which students can participate, and then starts a live quiz.

During the live quiz, each question is shown on one side of the screen and an interactive random student picker/roller is shown on the other side.

For every question, the teacher clicks "Pick a student". The roller animates through the students and finally lands on one student. That student is then asked to answer the current question.

After moving to the next question, the process repeats.

The feature should feel like a polished classroom activity rather than a normal quiz-taking interface.

============================================================
IMPORTANT: INSPECT THE EXISTING PROJECT FIRST
============================================================

Before writing or changing code, inspect the existing Medha codebase thoroughly.

There is already an existing Quiz Generation feature in the project.

Find and understand:

- existing quiz generation pages/routes
- quiz generation components
- class selection components
- subject selection components
- chapter/topic selection components
- quiz settings components
- question generation API/service
- quiz/question TypeScript types/interfaces
- generated question data structure
- edit-question functionality
- option editing functionality
- answer editing functionality
- existing buttons, cards, dialogs and form components
- existing design tokens
- existing typography
- existing colors
- existing spacing
- existing icon system
- existing animation library, if any
- existing API/data-fetching patterns
- existing student/class database API
- existing authentication/teacher context

Reuse the existing quiz-generation implementation wherever possible.

If existing components can be reused, reuse them.

Do not rewrite unrelated parts of the application.

============================================================
DESIGN REFERENCE
============================================================

The attached screenshots show the existing visual language of Medha.

The new feature MUST visually belong to this same product.

Do not introduce a completely different visual style.

Do not make the UI look like:
- a casino
- a gambling wheel
- a children's cartoon game
- a generic SaaS dashboard
- a random-name-generator website

The visual direction should be:

"modern educational classroom tool with playful interaction"

The configuration/review screens should remain calm and professional.

The live quiz screen can become more energetic because that is where the classroom interaction happens.

============================================================
OVERALL FLOW
============================================================

The new feature consists of 5 pages/steps:

PAGE 1:
Select quiz topics

PAGE 2:
Quiz settings

PAGE 3:
Select students

PAGE 4:
Review/edit generated quiz

PAGE 5:
Live classroom quiz with question + random student picker

The teacher should be able to move backward where appropriate.

Show a consistent step indicator at the top of Pages 1–4.

Example:

✓ Topics  →  2 Quiz settings  →  3 Students  →  4 Review

The active step should use the existing Medha purple accent.

Completed steps should show a checkmark.

============================================================
PAGE 1 — SELECT QUIZ TOPICS
============================================================

Reuse the existing quiz-generation Page 1 implementation as much as possible.

The page should contain:

Top navigation:

← Back to syllabus

Page title:

Quiz

Step indicator:

1  Topics
   ─────────
2  Quiz settings
3  Students
4  Review

At the top right, retain the existing class and subject context pills if those already exist.

Main content:

A two-column class/subject selection area.

LEFT:
Select Class

RIGHT:
Select Subject

Use the existing select/dropdown components from the current quiz-generation feature.

Once the teacher selects a class and subject, display the available chapters/topics below.

Chapter section:

┌────────────────────────────────────────────────────┐
│  ◇  Chapters                                      │
│     Select one chapter.                            │
│                                                    │
│  [Food: Where Does It Come From?]                  │
│  [Components of Food] [Fibre to Fabric]            │
│  [Sorting Materials into Groups]                   │
│  [Separation of Substances]                        │
│  [Changes Around Us]                               │
│  ...                                               │
└────────────────────────────────────────────────────┘

Use the same pill/chip selection pattern as the existing Quiz Generation UI.

Selected chapter should use the existing purple filled state.

At the bottom:

Left:
"Select one chapter."

Right:
[ Continue → ]

Continue remains disabled until the required topic information is selected.

IMPORTANT:
Reuse the existing topic/chapter fetching logic and data model.

Do not hardcode chapters.

============================================================
PAGE 2 — QUIZ SETTINGS
============================================================

Reuse the visual structure and functionality of the existing Quiz Settings page.

The top should retain:

← Back to syllabus

Quiz

Step indicator:

✓ Topics  →  2 Quiz settings  →  3 Students  →  4 Review

Main settings card:

Question count

[ 5 ] [ 10 ] [ 15 ] [ 20 ] [ 25 ] [ 30 ] [ Custom ]

Level

[ Easy ] [ Standard ] [ Hard ]

Below:

Quiz objective (optional)

[ multiline textarea ]

Use the exact existing quiz-generation behavior and styling where possible.

Bottom navigation:

← Back

[ Continue → ]

Do not generate the quiz yet if the current architecture generates it on a later step.

The goal of this page is to collect quiz-generation configuration.

============================================================
PAGE 3 — SELECT STUDENTS
============================================================

This is a new page.

Once the teacher selected the class on Page 1, fetch the students belonging to that class from the database.

Do NOT ask the teacher to manually enter student names.

The student list must come from the database.

The teacher should see all students in the selected class.

Page header:

← Back

Quiz

Step indicator:

✓ Topics  →  ✓ Quiz settings  →  3 Students  →  4 Review

Main title:

Select students

Subtitle:

Choose who can be picked during the quiz.

Main layout:

Use a large card.

Top of card:

LEFT:
"Students"

RIGHT:
"24 students"

Below the header:

Search input:

[ 🔍 Search students... ]

The search should filter by student name and, if the data supports it, roll number.

Below the search:

Student list.

Each student row should contain:

┌─────────────────────────────────────────────────────────┐
│  01    Aditi Sharma                              ✓      │
│        Class 6A                                        │
├─────────────────────────────────────────────────────────┤
│  02    Rahul Kumar                               ✓      │
│        Class 6A                                        │
├─────────────────────────────────────────────────────────┤
│  03    Priya Singh                               ✓      │
│        Class 6A                                        │
└─────────────────────────────────────────────────────────┘

The exact student metadata should use whatever exists in the database.

At minimum show:
- roll number
- student name
- selection state

Each row should have a remove/deselect action.

Use a subtle icon button rather than a visually heavy red delete button.

For example:

✓ selected

or

Remove

When removed, the student should visually become disabled/muted.

Do NOT delete the student from the database.

This only removes the student from the participant pool for THIS quiz session.

============================================================
STUDENT SEARCH
============================================================

The search field should sit above the student list.

As the teacher types:

"rah"

the list should immediately filter to matching students.

Show:

"1 student found"

or

"Showing 1 of 24 students"

Search should not change the actual selected participant pool.

If a student is removed and then searched, the teacher should still be able to add them back.

============================================================
SELECT / DESELECT ALL
============================================================

Above the student list, optionally provide:

[ Select all ]

[ Clear all ]

These should operate only on the current quiz participant list.

If all students are selected:

"24 / 24 selected"

If some have been removed:

"20 / 24 selected"

The count should update immediately.

============================================================
REPEAT STUDENT OPTION
============================================================

This is an important setting.

Add a separate setting near the bottom/top of the student card:

Repeat students

[ ON/OFF ]

Helper text:

"Allow a student to be picked more than once during this quiz."

Default behavior should be:

Repeat students = OFF

When OFF:
A student who has already been selected during the live quiz should be temporarily removed from the available picker pool.

When ON:
Every active student remains eligible for every question.

IMPORTANT:
This is different from removing students from Page 3.

Page 3 controls who is eligible to participate.

Repeat students controls whether an eligible student can be selected multiple times during the live quiz.

Do not confuse these states.

============================================================
PAGE 3 BOTTOM ACTION
============================================================

Bottom navigation:

← Back

[ Generate quiz → ]

The primary button should indicate that the next action is quiz generation.

Example:

[ Generate quiz ]

Use the existing AI/quiz generation button style if possible.

When clicked:

- validate the selected students
- validate quiz configuration
- call the existing quiz generation API/service
- show a proper loading state

Loading state:

Generating your quiz...

Avoid making the teacher wonder whether anything happened.

============================================================
PAGE 4 — REVIEW / EDIT GENERATED QUIZ
============================================================

After the existing quiz-generation process returns successfully, show a quiz review page.

This page should allow the teacher to inspect the generated quiz BEFORE starting the live classroom activity.

Top:

← Back

Quiz

Step indicator:

✓ Topics  →  ✓ Quiz settings  →  ✓ Students  →  4 Review

Below the step indicator:

Title:

Review your quiz

Subtitle:

Review and edit the questions before starting the classroom quiz.

Show quiz metadata near the top:

Class 6
Science
Components of Food
10 questions
Standard

Use small pill/badge components consistent with the existing Medha UI.

============================================================
QUESTION CAROUSEL
============================================================

Questions should be presented one at a time in a carousel.

Do NOT display 10 huge question cards vertically on one page.

Use a central question card.

Example:

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Question 3 of 10                                  Edit ✎  │
│                                                             │
│  Which nutrient is mainly responsible for growth and        │
│  repair of body tissues?                                    │
│                                                             │
│  ○ Carbohydrates                                            │
│  ○ Proteins                                                 │
│  ○ Fats                                                     │
│  ○ Vitamins                                                 │
│                                                             │
│  Answer: Proteins                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Below/around the card:

← Previous

Question 3 / 10

Next →

The question number should be visually prominent.

Provide a row of small question indicators if useful:

1  2  3  4  5  6  7  8  9  10

Current question uses purple.

Answered/reviewed questions can use a subtle completed state.

Do not make the navigation visually overwhelming.

============================================================
EDIT FUNCTIONALITY
============================================================

Each question should have an Edit button.

When clicked, allow the teacher to edit:

- question text
- answer options
- correct answer

Prefer inline editing or a polished dialog..

Do NOT navigate away from the review page unnecessarily.

The teacher should be able to save changes and continue browsing questions.

The correct answer should be clearly identifiable to the teacher but should NOT be visually exposed on the live classroom page.

============================================================
PAGE 4 START BUTTON
============================================================

At the bottom/right:

[ Start quiz → ]

This is the main action.

Before starting:

- ensure there is at least one valid question
- ensure each question has valid options/answer according to the existing quiz schema
- ensure at least one student is selected

When clicked, navigate to the LIVE QUIZ page.

The live quiz should receive:
- generated/edited questions
- selected students
- repeat setting
- class information
- subject/topic metadata

Avoid regenerating the quiz.

============================================================
PAGE 5 — LIVE CLASSROOM QUIZ
============================================================

This is the most important page of the entire feature.

This is where the teacher actually conducts the activity in front of the class.

The UI should feel different from the configuration screens, but still clearly belong to Medha.

Use a wider layout than the previous pages.

The live page should occupy the available viewport and minimize unnecessary scrolling.

============================================================
LIVE PAGE HEADER
============================================================

Top header:

← Exit quiz

Center or left:

Science · Components of Food

Right:

Question 1 / 10

Optional:

Class 6

Do NOT show unnecessary dashboard navigation.

The teacher is now in a focused classroom mode.

Consider making the header slightly more compact than the configuration pages.

============================================================
MAIN LIVE LAYOUT
============================================================

Desktop layout:

Approximately:

60% QUESTION
40% RANDOM PICKER

The question should have slightly more space because it is the educational content.

Example:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  QUESTION 1 OF 10                                               │
│                                                                 │
│  ┌───────────────────────────────────┐  ┌─────────────────────┐ │
│  │                                   │  │                     │ │
│  │  What is the main function of     │  │    WHO'S ANSWERING? │ │
│  │  proteins in our body?            │  │                     │ │
│  │                                   │  │                     │ │
│  │  A. Energy                        │  │       ROLLER        │ │
│  │                                   │  │                     │ │
│  │  B. Growth and repair             │  │      Aditi           │ │
│  │                                   │  │      Rahul           │ │
│  │  C. Water storage                 │  │  →   PRIYA   ←      │ │
│  │                                   │  │      Aman            │ │
│  │  D. Temperature control           │  │      Neha            │ │
│  │                                   │  │                     │ │
│  └───────────────────────────────────┘  │ [ Pick a student ] │ │
│                                         └─────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

The question and picker should feel like two coordinated panels.

============================================================
QUESTION CARD
============================================================

The question card should be large and highly readable from a classroom display/projector.

Show:

Question 1 of 10

Then the question text.

Use large typography.

Example:

"What is the main function of proteins in our body?"

Options should be clearly separated.

Example:

A    Energy

B    Growth and repair

C    Water storage

D    Temperature control

Do not show the correct answer during normal live mode.

The question card should have enough whitespace.

Avoid dense dashboard styling.

============================================================
RANDOM PICKER
============================================================

The random picker should be the interactive visual hero.

Use a vertical roller / slot-machine style interaction rather than a basic random text change.

Picker header:

"Who's answering?"

Inside the picker:

Show 3–5 visible student names.

The central row is the selected/active region.

Example:

        Aditi
   ─────────────
        Rahul
   ═════════════
        PRIYA
   ═════════════
        Aman
   ─────────────

The central student should be visually emphasized.

Below:

[ Pick a student ]

The button should be large enough to be used easily by a teacher.

============================================================
ROLLER ANIMATION
============================================================

When the teacher clicks "Pick a student":

1. Disable the button.
2. Change text to "Picking..."
3. Start the roller.
4. Student names rapidly cycle.
5. Animation accelerates.
6. Reach high speed.
7. Gradually decelerate.
8. Stop on the predetermined selected student.
9. Emphasize the selected student.
10. Show the result state.

Target duration:
approximately 3–4 seconds.

Do not make every pick excessively long.

The experience should create suspense without frustrating the teacher.

============================================================
RANDOMNESS
============================================================

IMPORTANT:

Determine the actual winner BEFORE starting the animation.

Conceptually:

const winner = selectRandomStudent(availableStudents)

Then animate the roller until it visually lands on that winner.

Do NOT select the student based on whichever name happens to be displayed when the animation stops.

This is required for correctness and testability.

============================================================
WINNER STATE
============================================================

When the roller stops, transform the picker into a winner state.

Example:

┌───────────────────────────┐
│                           │
│     IT'S YOUR TURN!       │
│                           │
│         PRIYA             │
│                           │
│       ✓ Selected          │
│                           │
└───────────────────────────┘

Use a subtle celebratory animation.

Possible effects:
- scale spring
- fade
- small particles/confetti
- subtle glow
- checkmark animation

Do NOT make it look like a casino jackpot.

The teacher should immediately know:

"Priya is answering this question."

============================================================
IMPORTANT: DO NOT USE A BLOCKING MODAL BY DEFAULT
============================================================

For the live classroom page, prefer keeping the winner visible inside the picker panel rather than immediately opening a large modal.

The teacher needs to keep looking at the question.

The selected student's name should remain visible next to the question.

For example:

QUESTION                     STUDENT

What is...?                  PRIYA
                             is answering

                             [ Next question → ]

A modal can be used for a short celebratory reveal if it improves the animation, but it should close automatically or transition smoothly into the winner state.

Do not force the teacher to close a modal after every question.

============================================================
AFTER STUDENT IS PICKED
============================================================

Once a student is selected:

The primary action should change from:

[ Pick a student ]

to something like:

[ Next question → ]

or:

[ Mark answered & continue → ]

The teacher should be able to proceed to the next question.

Do not allow another random pick for the same question unless there is an intentional "Pick again" action.

If the teacher accidentally picked the wrong student, provide a subtle:

"Pick again"

secondary action.

When "Pick again" is used:
- the current selection is replaced
- if repeats are disabled, the previous selection should become available again
- the new selected student becomes the current participant

============================================================
MOVING TO NEXT QUESTION
============================================================

When the teacher clicks:

Next question →

Transition smoothly.

Question number changes:

Question 1 of 10
→
Question 2 of 10

The question content changes.

The picker resets to its idle state.

The teacher must then click:

[ Pick a student ]

again.

Do NOT automatically pick the next student.

The teacher should control when the classroom is ready.

============================================================
NO-REPEAT LOGIC
============================================================

If repeat students = OFF:

After Priya answers Question 1:

Priya becomes temporarily unavailable for Question 2.

The picker should use:

availableStudents =
selectedStudents - alreadyPickedStudents

The UI should make this understandable.

For example, below the picker:

"4 students remaining"

or:

"Priya has already answered"

Do not remove Priya from the Page 3 student list.

This is only a live-session state.

If every eligible student has been picked and there are still questions remaining:

Show:

"Everyone has had a turn."

Then provide:

[ Start another round ]

or automatically reset the available pool for the next question depending on the intended product behavior.

Prefer making this behavior explicit rather than silently doing something surprising.

============================================================
REPEAT STUDENTS = ON
============================================================

If repeat students is ON:

All selected students remain eligible after every question.

A student can be selected multiple times.

The teacher should see a small indicator:

"Students may be picked more than once"

============================================================
QUESTION PROGRESS
============================================================

Show clear progress throughout the live quiz.

Example:

Question 4 of 10

and a progress indicator:

● ● ● ● ○ ○ ○ ○ ○ ○

or:

████░░░░░░ 40%

Keep it subtle.

The question itself should remain the main focus.

============================================================
END OF QUIZ
============================================================

After the final question:

Do not immediately redirect.

Show a completion state.

Example:

──────────────────────────────

        Quiz complete

        10 questions
        10 students participated

        Great job!

        [ Finish ]

──────────────────────────────

If the system tracks participation, show useful summary information.

For example:

Questions answered:
10

Students called:
8

Students who participated:
8

Do not expose unnecessary analytics unless supported by the existing data model.

============================================================
EXIT QUIZ
============================================================

The top-left should have:

← Exit quiz

Clicking it should warn the teacher if the quiz is in progress.

Example dialog:

Exit quiz?

Your current classroom session will end.

[ Continue quiz ]

[ Exit ]

Do not accidentally lose the generated/edited quiz if the architecture allows it to be preserved.

============================================================
RESPONSIVE DESIGN
============================================================

Desktop is the primary experience because this tool will often be displayed on a classroom computer/projector.

However, it must also work on tablets and smaller screens.

Desktop:

Question panel ~60%
Picker panel ~40%

Tablet:

Question panel ~55%
Picker panel ~45%

Mobile:

Stack:

1. Question
2. Picker
3. Action buttons

Do NOT simply shrink the desktop UI.

The question text must remain readable.

The picker must remain large enough to feel interactive.

============================================================
VISUAL SYSTEM
============================================================

Match the existing Medha UI exactly wherever possible.

Use existing:
- font family
- heading styles
- body styles
- border radius
- button styles
- input styles
- purple accent
- warm background
- card borders
- icons
- spacing scale

Do not introduce unnecessary gradients.

Do not use glassmorphism.

Do not use excessive shadows.

Do not use neon colors.

Use animation and interaction rather than excessive decoration to make the feature engaging.

============================================================
ANIMATION SYSTEM
============================================================

If the existing project already uses Framer Motion / Motion or another animation library, use the existing library.

Do not introduce another animation dependency unnecessarily.

Animations should include:

Page transitions:
subtle fade/slide

Question transition:
small horizontal/vertical transition

Roller:
accelerate → fast → decelerate → stop

Winner:
spring scale + fade

Progress:
smooth transition

Button:
hover/press feedback

Respect:

prefers-reduced-motion

When reduced motion is enabled:
- skip the long roller animation
- use a short transition
- still clearly reveal the selected student

============================================================
ACCESSIBILITY
============================================================

All controls must be keyboard accessible.

Use semantic buttons.

Use visible focus states.

Maintain sufficient contrast.

The picker animation should not spam screen readers with every name.

Use aria-live only for meaningful states.

For example:

"Picking a student..."

then:

"Priya has been selected to answer question 3."

The live quiz should not become inaccessible because of animation.

============================================================
STATE MANAGEMENT
============================================================

Keep these states conceptually separate:

1. Quiz configuration
2. Generated quiz
3. Edited quiz
4. Selected students
5. Repeat-student setting
6. Current question index
7. Already-picked students
8. Current picker winner
9. Picker animation state
10. Quiz completion state

Do not mix animation state with random-selection state.

For example:

pickerState:
idle | picking | selected

currentWinner:
Student | null

currentQuestionIndex:
number

pickedStudentIds:
Set<string>

selectedStudentIds:
Set<string>

This is conceptual; follow the project's existing state-management patterns.

============================================================
DATA / DATABASE
============================================================

Students MUST come from the database based on the selected class.

Do not hardcode student names.

Use the existing class/student API if one exists.

Do not mutate/delete students in the database when a teacher removes them from the quiz.

The Page 3 removal is session-level only.

If the project has stable student IDs, always use IDs internally.

Do NOT use student names as unique identifiers.

This is especially important because two students may have the same name.

============================================================
QUIZ DATA
============================================================

Reuse the existing quiz data structure.

Do not create a second incompatible Question interface.

The live quiz should consume the same generated/edited question objects used by the existing quiz system wherever possible.

The live page needs only the information necessary to display:

- question text
- options
- question number

The correct answer should remain hidden from the live student-facing view.

The teacher may have access to the correct answer through an optional teacher-only control if useful, but do not display it prominently.

============================================================
ERROR / LOADING STATES
============================================================

Implement polished states for:

Class loading

Students loading

Students failed to load

Quiz generation loading

Quiz generation failed

No students in selected class

Only one selected student

No selected students

Quiz generation returned invalid questions

Live quiz loading/initialization

Unexpected navigation/reload

Do not show raw API errors to teachers.

Use friendly messages.

Example:

"We couldn't load the students for this class."

[ Try again ]

============================================================
IMPORTANT UX RULES
============================================================

1. Never make the teacher manually type students when a class has already been selected.

2. Never delete students from the database because the teacher removes them from this quiz.

3. Keep Page 3 participant selection separate from live-session no-repeat logic.

4. Never regenerate a quiz when starting the live quiz.

5. Never randomly select the winner after the roller animation.

6. Select the winner first, animate second.

7. Never automatically pick the next student when moving to the next question.

8. The teacher controls when each student is picked.

9. Do not force a modal to be closed after every student selection.

10. The teacher must always be able to see the current question and selected student together.

11. Preserve the existing Medha visual language.

12. Reuse existing quiz-generation code rather than duplicating it.

============================================================
IMPLEMENTATION STRATEGY
============================================================

Before coding, map the existing architecture.

Identify:

- current quiz generation route
- current quiz generation components
- current quiz API
- current class API
- current student API
- current quiz/question types
- current design components
- current dialog/modal component
- current button/input/select components
- current animation library

Then decide which existing components can be reused.

Create new components only where functionality is genuinely new.

Suggested conceptual component structure:

QuizWithRandomPicker
│
├── QuizTopicsStep
│
├── QuizSettingsStep
│
├── StudentSelectionStep
│   ├── StudentSearch
│   ├── StudentList
│   ├── StudentRow
│   └── RepeatStudentsToggle
│
├── QuizReviewStep
│   ├── QuestionCarousel
│   ├── QuestionCard
│   └── QuestionEditor
│
└── LiveQuiz
    ├── LiveQuizHeader
    ├── QuestionPanel
    ├── RandomStudentPicker
    ├── Roller
    ├── WinnerState
    └── QuizCompletion

These are conceptual names only. Follow the project's existing naming conventions.

============================================================
FINAL QUALITY BAR
============================================================

The finished feature should feel like this:

A teacher opens Medha.

They select:

Class 6
Science
Components of Food

They choose:

10 questions
Standard difficulty

They see the class roster.

They remove a few students if necessary.

They choose whether students can repeat.

They click Generate Quiz.

Medha generates the quiz.

The teacher quickly reviews and edits questions.

They click Start Quiz.

The screen transforms into a classroom mode.

A large question appears on the left.

The random picker appears on the right.

Teacher clicks:

Pick a student

The roller spins.

Student names fly past.

The roller slows.

It lands on:

PRIYA

The selected student is clearly announced visually.

Priya answers the question.

Teacher clicks:

Next question

The next question appears.

Teacher clicks:

Pick a student

The process repeats.

The experience should feel polished, fair, exciting and extremely easy to operate during a real classroom.

============================================================
DO NOT STOP AT A STATIC UI
============================================================

Implement the complete functional flow.

Do not only create the pages visually.

The following must actually work:

- class selection
- subject selection
- chapter selection
- quiz settings
- database student loading
- student search
- student removal
- student re-selection
- repeat-student setting
- existing quiz generation
- generated quiz display
- question carousel
- question editing
- option editing
- answer editing
- start quiz
- random student selection
- roller animation
- no-repeat logic
- repeat logic
- next question
- previous/back navigation where appropriate
- quiz completion
- exit confirmation
- responsive layout
- accessibility

After implementation, test the complete flow from Page 1 → Page 5.