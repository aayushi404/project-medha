import type { StudentRosterItem } from "@/lib/api";
import type { QuizContent } from "@/lib/generation-types";

/** The 5 pages of the flow. Kept as one internal state machine (not separate
 *  routes) so moving backward is trivial and a generated quiz never has to be
 *  serialized through a URL. */
export type LiveStep = "topics" | "settings" | "students" | "review" | "live";

export type QuizQ = QuizContent["questions"][number];

/** A roster student plus the one thing the live session needs to know beyond
 *  identity: whether the teacher kept them in the participant pool on the
 *  Students step. Session-only -- never written back to the roster. */
export type Participant = {
  id: string;
  name: string;
  rollNumber: string | null;
  gradeLabel: string;
};

/** Picker state during the live page. Deliberately separate from
 *  `currentWinnerId` / `pickedStudentIds` (owned by the live-quiz component) --
 *  this is only the animation phase. */
export type PickerPhase = "idle" | "picking" | "selected";

/** The class roster fetch, owned by the orchestrator and handed down to both
 *  the Students step and (already resolved into Participants) the Live step,
 *  so the class is only ever fetched once per selection. */
export type RosterState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; students: StudentRosterItem[] };
