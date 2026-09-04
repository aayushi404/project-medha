const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Role = "admin" | "principal" | "teacher" | "student";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Teacher = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  approval_status: ApprovalStatus;
  school_id: string | null;
  grade_id: string | null;
  roll_number: string | null;
  onboarded_at: string | null;
};

export type TokenOut = {
  access_token: string;
  expires_in: number;
};

/**
 * Raised by the auth-context `login()` when the backend rejects an otherwise
 * valid credential because the account isn't approved yet. `code` is the
 * backend's machine-readable reason (`PENDING_APPROVAL` | `REGISTRATION_REJECTED`).
 */
export class AuthError extends Error {
  code: string;
  reason: string | null;

  constructor(code: string, message: string, reason: string | null = null) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.reason = reason;
  }
}

export type Grade = {
  id: string;
  label: string;
  numeric_level: number;
};

export type Subject = {
  id: string;
  name: string;
  board: string;
};

export type SchoolSearchResult = {
  id: string;
  name: string;
  district_name: string;
  block_name: string | null;
  udise_code: string | null;
};

export type TeacherSubjectPayload = {
  subject_id: string;
  grade_id: string;
  is_primary: boolean;
};

export type OnboardingCompleteInput = {
  full_name: string;
  school_id: string;
  subjects: TeacherSubjectPayload[];
};

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

/**
 * Thin fetch wrapper for the FastAPI backend. `credentials: "include"` is
 * required on every call so the browser sends/receives the httpOnly refresh
 * cookie -- the backend's CORS middleware must echo back this exact origin
 * (not "*") with allow_credentials=True for that to work cross-origin.
 */
export function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { method = "GET", body, token, signal } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    // API responses carry no cache headers; never let the browser serve a
    // stale body (e.g. /auth/me after the profile changed server-side).
    cache: "no-store",
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export { API_BASE_URL };

/** Pulls a human-readable message out of a FastAPI error response. */
export async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.error?.message === "string") return data.error.message;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && typeof data.detail[0]?.msg === "string") {
      return data.detail[0].msg as string;
    }
    if (typeof data.message === "string") return data.message;
  } catch {
    // response body wasn't JSON -- fall through to the generic message
  }
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Phase 1 -- lesson generation. Types mirror the FastAPI response bodies in
// docs/phase-1/{03,05,06}. Each fetcher returns parsed JSON or throws Error.
// ---------------------------------------------------------------------------

async function json<T>(pending: Promise<Response>): Promise<T> {
  const res = await pending;
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return (await res.json()) as T;
}

export type ProfileSubject = {
  subject_id: string;
  subject_name: string;
  grade_id: string;
  grade_label: string;
  numeric_level: number;
  is_primary: boolean;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  preferred_language: string;
  onboarded_at: string | null;
  school: { id: string; name: string; district_name: string } | null;
  subjects: ProfileSubject[];
};

export type Chapter = { id: string; chapter_number: number; title: string };
export type Topic = {
  id: string;
  title: string;
  description: string | null;
  sequence_order: number;
};

export type ChatSession = {
  id: string;
  grade_id: string;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: "teacher" | "assistant";
  content: string;
  created_at: string;
};

export type ChatSessionDetail = ChatSession & {
  messages: ChatMessage[];
  module_id: string | null;
};

export type ArtifactType = "explanation" | "quiz" | "activity";

export type QuizContent = {
  questions: {
    q: string;
    type: "mcq" | "short" | "truefalse";
    options?: string[];
    answer: string;
    difficulty: "easy" | "medium" | "hard";
  }[];
};

export type ActivityContent = {
  title: string;
  materials: string[];
  group_size: number;
  duration_min: number;
  steps: string[];
  variation: string;
};

export type ModuleArtifact = {
  id: string;
  artifact_type: ArtifactType;
  content_json: ({ text?: string } & Partial<QuizContent> & Partial<ActivityContent>) | null;
  created_at: string;
};

export type ModuleListItem = {
  id: string;
  title: string;
  grade_id: string;
  grade_label: string;
  subject_id: string;
  subject_name: string;
  chapter_id: string | null;
  topic_id: string | null;
  topic_title: string | null;
  artifact_types: ArtifactType[];
  updated_at: string;
};

export type Feedback = {
  rating: 1 | -1 | null;
  comment: string | null;
  created_at: string;
};

export type ModuleDetail = {
  id: string;
  title: string;
  grade_label: string;
  subject_name: string;
  topic_title: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  artifacts: ModuleArtifact[];
  feedback: Feedback | null;
};

// --- fetchers ---

export const getProfile = (token: string | null) =>
  json<Profile>(apiFetch("/profile", { token }));

export type SubjectSelectionInput = {
  subject_id: string;
  grade_id: string;
  is_primary: boolean;
};

export const patchProfile = (
  token: string | null,
  body: {
    full_name?: string;
    preferred_language?: string;
    subjects?: SubjectSelectionInput[];
  },
) => json<Profile>(apiFetch("/profile", { method: "PATCH", token, body }));

export const getGrades = () => json<Grade[]>(apiFetch("/reference/grades"));
export const getSubjects = () => json<Subject[]>(apiFetch("/reference/subjects"));

export const getChapters = (gradeId: string, subjectId: string) =>
  json<Chapter[]>(
    apiFetch(`/curriculum/chapters?grade_id=${gradeId}&subject_id=${subjectId}`),
  );

export const getTopics = (chapterId: string) =>
  json<Topic[]>(apiFetch(`/curriculum/topics?chapter_id=${chapterId}`));

export const createSession = (
  token: string | null,
  body: {
    grade_id: string;
    subject_id: string;
    chapter_id?: string | null;
    topic_id?: string | null;
  },
) => json<ChatSession>(apiFetch("/chat/sessions", { method: "POST", token, body }));

export const listSessions = (token: string | null) =>
  json<Pick<ChatSession, "id" | "title" | "grade_id" | "subject_id" | "topic_id" | "updated_at">[]>(
    apiFetch("/chat/sessions", { token }),
  );

export const getSession = (token: string | null, id: string) =>
  json<ChatSessionDetail>(apiFetch(`/chat/sessions/${id}`, { token }));

export const listModules = (
  token: string | null,
  filter: { gradeId?: string; subjectId?: string; chapterId?: string } = {},
) => {
  const qs = new URLSearchParams();
  if (filter.gradeId) qs.set("grade_id", filter.gradeId);
  if (filter.subjectId) qs.set("subject_id", filter.subjectId);
  if (filter.chapterId) qs.set("chapter_id", filter.chapterId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return json<ModuleListItem[]>(apiFetch(`/modules${suffix}`, { token }));
};

export const getModule = (token: string | null, id: string) =>
  json<ModuleDetail>(apiFetch(`/modules/${id}`, { token }));

export const deleteModule = async (token: string | null, id: string) => {
  const res = await apiFetch(`/modules/${id}`, { method: "DELETE", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

export const sendFeedback = (
  token: string | null,
  id: string,
  body: { rating: 1 | -1; comment?: string | null },
) => json<Feedback>(apiFetch(`/modules/${id}/feedback`, { method: "POST", token, body }));

// ---------------------------------------------------------------------------
// Role-based registration + approval. Registering never logs you in -- it
// creates a pending account that an admin (principals) or principal (teachers)
// has to approve. See docs/medha-auth-approval-plan.md.
// ---------------------------------------------------------------------------

export type RegisterRole = "principal" | "teacher";

export type RegisterInput = {
  role: RegisterRole;
  full_name: string;
  email: string;
  password: string;
  mobile_number: string;
  school_id: string;
  employee_code?: string | null;
  years_of_experience?: number | null;
  qualification?: string | null;
};

export type RegisterResult = { status: "pending"; role: string; message: string };

export const register = (input: RegisterInput) =>
  json<RegisterResult>(apiFetch("/auth/register", { method: "POST", body: input }));

// --- admin ---

export type AdminStats = {
  schools: number;
  principals: number;
  teachers: number;
  pending_principals: number;
};

export type PendingPrincipal = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string | null;
  qualification: string | null;
  school_id: string;
  school_name: string;
  district_name: string;
  applied_at: string;
};

export type SchoolPrincipalStatus = {
  school_id: string;
  school_name: string;
  district_name: string;
  principal_name: string | null;
  principal_email: string | null;
  principal_status: ApprovalStatus | null;
};

export type ApprovalResult = { id: string; approval_status: ApprovalStatus };

export const getAdminStats = (token: string | null) =>
  json<AdminStats>(apiFetch("/admin/stats", { token }));

export const getPendingPrincipals = (token: string | null) =>
  json<PendingPrincipal[]>(apiFetch("/admin/principals/pending", { token }));

export const getAdminSchools = (token: string | null) =>
  json<SchoolPrincipalStatus[]>(apiFetch("/admin/schools", { token }));

export const approvePrincipal = (token: string | null, id: string) =>
  json<ApprovalResult>(
    apiFetch(`/admin/principals/${id}/approve`, { method: "POST", token }),
  );

export const rejectPrincipal = (token: string | null, id: string, reason: string) =>
  json<ApprovalResult>(
    apiFetch(`/admin/principals/${id}/reject`, { method: "POST", token, body: { reason } }),
  );

// --- principal ---

export type PrincipalStats = {
  teachers: number;
  pending_teachers: number;
  students: number;
  pending_students: number;
};

export type PendingTeacher = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string | null;
  employee_code: string | null;
  years_of_experience: number | null;
  qualification: string | null;
  applied_at: string;
};

export type TeacherRosterItem = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string | null;
  employee_code: string | null;
  years_of_experience: number | null;
  approved_at: string | null;
};

export const getPrincipalStats = (token: string | null) =>
  json<PrincipalStats>(apiFetch("/principal/stats", { token }));

export const getPrincipalTeachers = (token: string | null) =>
  json<TeacherRosterItem[]>(apiFetch("/principal/teachers", { token }));

export const getPendingTeachers = (token: string | null) =>
  json<PendingTeacher[]>(apiFetch("/principal/teachers/pending", { token }));

export const approveTeacher = (token: string | null, id: string) =>
  json<ApprovalResult>(
    apiFetch(`/principal/teachers/${id}/approve`, { method: "POST", token }),
  );

export const rejectTeacher = (token: string | null, id: string, reason: string) =>
  json<ApprovalResult>(
    apiFetch(`/principal/teachers/${id}/reject`, { method: "POST", token, body: { reason } }),
  );

// ---------------------------------------------------------------------------
// Student role. Two-phase onboarding: register (class + roll number, no
// credential) -> a teacher approves -> activate (set email + password) ->
// log in through /auth/login. See docs/medha-student-role-plan.md.
// ---------------------------------------------------------------------------

export type StudentRegisterInput = {
  full_name: string;
  school_id: string;
  grade_id: string;
  roll_number: string;
};

export type StudentActivateInput = {
  school_id: string;
  grade_id: string;
  roll_number: string;
  full_name: string;
  email: string;
  password: string;
};

export type StudentRegisterResult = { status: "pending"; message: string };
export type StudentActivateResult = { status: "activated"; message: string };

export const registerStudent = (input: StudentRegisterInput) =>
  json<StudentRegisterResult>(
    apiFetch("/student/register", { method: "POST", body: input }),
  );

export const activateStudent = (input: StudentActivateInput) =>
  json<StudentActivateResult>(
    apiFetch("/student/activate", { method: "POST", body: input }),
  );

// --- teacher-facing student approvals ---

export type TeacherStudentStats = { students: number; pending_students: number };

export type PendingStudent = {
  id: string;
  full_name: string;
  grade_id: string;
  grade_label: string;
  roll_number: string | null;
  applied_at: string;
};

export type StudentRosterItem = {
  id: string;
  full_name: string;
  grade_id: string;
  grade_label: string;
  roll_number: string | null;
  email: string | null;
  activated: boolean;
  approved_at: string | null;
};

export const getTeacherStudentStats = (token: string | null) =>
  json<TeacherStudentStats>(apiFetch("/teacher/students/stats", { token }));

export const getPendingStudents = (token: string | null) =>
  json<PendingStudent[]>(apiFetch("/teacher/students/pending", { token }));

export const getStudentRoster = (token: string | null) =>
  json<StudentRosterItem[]>(apiFetch("/teacher/students", { token }));

export const approveStudent = (token: string | null, id: string) =>
  json<ApprovalResult>(
    apiFetch(`/teacher/students/${id}/approve`, { method: "POST", token }),
  );

export const rejectStudent = (token: string | null, id: string, reason: string) =>
  json<ApprovalResult>(
    apiFetch(`/teacher/students/${id}/reject`, { method: "POST", token, body: { reason } }),
  );

// --- tutor (student doubt chat) ---

export type TutorSession = {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type TutorMessage = {
  id: string;
  role: "student" | "assistant";
  content: string;
  created_at: string;
};

export type TutorSessionDetail = TutorSession & { messages: TutorMessage[] };

export const createTutorSession = (
  token: string | null,
  body: { subject_id: string; chapter_id: string },
) => json<TutorSession>(apiFetch("/tutor/sessions", { method: "POST", token, body }));

export const listTutorSessions = (token: string | null) =>
  json<Pick<TutorSession, "id" | "title" | "subject_id" | "chapter_id" | "updated_at">[]>(
    apiFetch("/tutor/sessions", { token }),
  );

export const getTutorSession = (token: string | null, id: string) =>
  json<TutorSessionDetail>(apiFetch(`/tutor/sessions/${id}`, { token }));

// --- Learn English (student) ---

export type EnglishSession = {
  id: string;
  lesson_topic: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type EnglishMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export type EnglishSessionDetail = EnglishSession & { messages: EnglishMessage[] };

export const createEnglishSession = (
  token: string | null,
  body: { lesson_topic?: string | null } = {},
) => json<EnglishSession>(apiFetch("/english/sessions", { method: "POST", token, body }));

export const getEnglishSession = (token: string | null, id: string) =>
  json<EnglishSessionDetail>(apiFetch(`/english/sessions/${id}`, { token }));

export type TranslatePayload = {
  text: string;
  target_language: string;
  mode: string;
  reading_level: string;
};

export type TranslateResult = {
  result: string;
  mode: string;
  target_language: string;
};

export const translateText = (token: string | null, body: TranslatePayload) =>
  json<TranslateResult>(apiFetch("/tools/translate", { method: "POST", token, body }));

// ---------------------------------------------------------------------------
// Notifications: an in-app inbox for every role, plus a principal ->
// school-wide / teacher -> own-grade announce composer. Push (FCM) is handled
// entirely server-side once a device token is registered elsewhere (mobile);
// the web client only reads/writes the in-app inbox.
// ---------------------------------------------------------------------------

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type AnnounceInput = {
  title: string;
  body: string;
  audience?: "teachers" | "students";
  grade_id?: string;
};

export const listNotifications = (token: string | null) =>
  json<AppNotification[]>(apiFetch("/notifications", { token }));

export const getUnreadCount = (token: string | null) =>
  json<{ count: number }>(apiFetch("/notifications/unread-count", { token }));

export const markNotificationRead = async (token: string | null, id: string) => {
  const res = await apiFetch(`/notifications/${id}/read`, { method: "POST", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

export const announce = (token: string | null, body: AnnounceInput) =>
  json<{ recipients: number }>(apiFetch("/notifications/announce", { method: "POST", token, body }));

// ---------------------------------------------------------------------------
// Homework: a teacher assigns to a grade (optionally tied to a subject);
// students see their own list and toggle done/not-done.
// ---------------------------------------------------------------------------

export type HomeworkListItem = {
  id: string;
  title: string;
  grade_label: string;
  subject_name: string | null;
  due_date: string | null;
  created_at: string;
  done_count: number;
  total_count: number;
};

export type HomeworkDetail = {
  id: string;
  title: string;
  description: string | null;
  grade_label: string;
  subject_name: string | null;
  due_date: string | null;
  created_at: string;
};

export type HomeworkStudentItem = {
  id: string;
  title: string;
  description: string | null;
  subject_name: string | null;
  due_date: string | null;
  done: boolean;
  created_at: string;
};

export type HomeworkCreateInput = {
  grade_id: string;
  subject_id?: string | null;
  title: string;
  description?: string | null;
  due_date?: string | null;
};

export const createHomework = (token: string | null, body: HomeworkCreateInput) =>
  json<HomeworkDetail>(apiFetch("/homework", { method: "POST", token, body }));

export const listHomework = (token: string | null) =>
  json<HomeworkListItem[]>(apiFetch("/homework", { token }));

export const listMyHomework = (token: string | null) =>
  json<HomeworkStudentItem[]>(apiFetch("/homework/mine", { token }));

export const markHomeworkDone = (token: string | null, id: string) =>
  json<HomeworkStudentItem>(apiFetch(`/homework/${id}/done`, { method: "POST", token }));

export const markHomeworkUndone = (token: string | null, id: string) =>
  json<HomeworkStudentItem>(apiFetch(`/homework/${id}/undone`, { method: "POST", token }));

// ---------------------------------------------------------------------------
// Timetable: one weekly grid per grade (Mon-Sat x periods), read by anyone at
// the school, edited by a teacher or principal.
// ---------------------------------------------------------------------------

export type TimetableSlot = {
  day_of_week: number; // 0 = Monday
  period_number: number;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
};

export type Timetable = {
  grade_id: string;
  grade_label: string;
  slots: TimetableSlot[];
};

export type TimetableSlotInput = {
  day_of_week: number;
  period_number: number;
  subject_id?: string | null;
  teacher_id?: string | null;
};

export const getTimetable = (token: string | null, gradeId: string) =>
  json<Timetable>(apiFetch(`/timetable?grade_id=${gradeId}`, { token }));

export const setTimetable = (
  token: string | null,
  body: { grade_id: string; slots: TimetableSlotInput[] },
) => json<Timetable>(apiFetch("/timetable", { method: "PUT", token, body }));

// ---------------------------------------------------------------------------
// Report card: a teacher enters marks per subject/term for a student they
// teach; the student (or their teacher/principal) can view the whole card.
// ---------------------------------------------------------------------------

export type ReportCardMark = {
  subject_id: string;
  subject_name: string;
  term: string;
  marks_obtained: number;
  max_marks: number;
  remarks: string | null;
  updated_at: string;
};

export type ReportCard = {
  student_id: string;
  student_name: string;
  marks: ReportCardMark[];
};

export type ReportCardMarkInput = {
  student_id: string;
  subject_id: string;
  term: string;
  marks_obtained: number;
  max_marks?: number;
  remarks?: string | null;
};

export const upsertReportCardMark = (token: string | null, body: ReportCardMarkInput) =>
  json<ReportCardMark>(apiFetch("/report-card/marks", { method: "POST", token, body }));

export const getReportCard = (token: string | null, studentId: string) =>
  json<ReportCard>(apiFetch(`/report-card/${studentId}`, { token }));

// ---------------------------------------------------------------------------
// E-library: curated links (not file storage), added by a teacher or
// principal, browsable by anyone, optionally filtered by grade/subject.
// ---------------------------------------------------------------------------

export type LibraryItem = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  grade_label: string | null;
  subject_name: string | null;
  created_at: string;
};

export type LibraryItemInput = {
  title: string;
  description?: string | null;
  url: string;
  grade_id?: string | null;
  subject_id?: string | null;
};

export const listLibraryItems = (
  token: string | null,
  filter: { gradeId?: string; subjectId?: string } = {},
) => {
  const qs = new URLSearchParams();
  if (filter.gradeId) qs.set("grade_id", filter.gradeId);
  if (filter.subjectId) qs.set("subject_id", filter.subjectId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return json<LibraryItem[]>(apiFetch(`/library${suffix}`, { token }));
};

export const addLibraryItem = (token: string | null, body: LibraryItemInput) =>
  json<LibraryItem>(apiFetch("/library", { method: "POST", token, body }));

export const deleteLibraryItem = async (token: string | null, id: string) => {
  const res = await apiFetch(`/library/${id}`, { method: "DELETE", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

// ---------------------------------------------------------------------------
// Fees: a manually-kept payment log. Only a principal logs a payment; a
// student sees their own history, a teacher/principal can look up any
// student at their school.
// ---------------------------------------------------------------------------

export type FeePayment = {
  id: string;
  amount: number;
  fee_type: string;
  payment_date: string;
  note: string | null;
  logged_by_name: string;
  created_at: string;
};

export type FeePaymentInput = {
  student_id: string;
  amount: number;
  fee_type: string;
  payment_date: string;
  note?: string | null;
};

export const logFeePayment = (token: string | null, body: FeePaymentInput) =>
  json<FeePayment>(apiFetch("/fees", { method: "POST", token, body }));

export const listFees = (token: string | null, studentId: string) =>
  json<FeePayment[]>(apiFetch(`/fees/${studentId}`, { token }));

// --- principal: school-wide student roster (for pickers, e.g. logging a fee) ---

export const getPrincipalStudents = (token: string | null) =>
  json<StudentRosterItem[]>(apiFetch("/principal/students", { token }));

// ---------------------------------------------------------------------------
// Chapter notes and practice questions: teacher/principal-curated student
// content, kept separate from the private `modules` feature (those stay
// visible only to the teacher who generated them).
// ---------------------------------------------------------------------------

export type ChapterNote = {
  id: string;
  chapter_id: string;
  summary: string;
  key_points: string[];
  important_terms: string[];
  updated_at: string;
};

export type ChapterNoteInput = {
  chapter_id: string;
  summary: string;
  key_points: string[];
  important_terms: string[];
};

export const getChapterNotes = (token: string | null, chapterId: string) =>
  json<ChapterNote | null>(apiFetch(`/notes?chapter_id=${chapterId}`, { token }));

export const upsertChapterNote = (token: string | null, body: ChapterNoteInput) =>
  json<ChapterNote>(apiFetch("/notes", { method: "POST", token, body }));

export type PracticeQuestion = {
  id: string;
  chapter_id: string;
  question: string;
  type: "mcq" | "short" | "truefalse";
  options: string[] | null;
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  created_at: string;
};

export type PracticeQuestionInput = {
  chapter_id: string;
  question: string;
  type: "mcq" | "short" | "truefalse";
  options?: string[] | null;
  answer: string;
  difficulty: "easy" | "medium" | "hard";
};

export const getPracticeQuestions = (token: string | null, chapterId: string) =>
  json<PracticeQuestion[]>(apiFetch(`/practice?chapter_id=${chapterId}`, { token }));

export const addPracticeQuestion = (token: string | null, body: PracticeQuestionInput) =>
  json<PracticeQuestion>(apiFetch("/practice", { method: "POST", token, body }));

export const deletePracticeQuestion = async (token: string | null, id: string) => {
  const res = await apiFetch(`/practice/${id}`, { method: "DELETE", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

