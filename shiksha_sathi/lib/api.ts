import type { GenerationType, ParamsFor } from "@/lib/generation-types";

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
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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

export type ArtifactType = "explanation" | "quiz" | "activity" | "ppt";

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

export type SlideSpec = {
  layout?: string;
  heading: string;
  bullets: string[];
  notes?: string;
};

export type DeckContent = {
  title: string;
  subtitle?: string;
  slides: SlideSpec[];
};

export type ModuleArtifact = {
  id: string;
  artifact_type: ArtifactType;
  content_json:
    | ({ text?: string } & Partial<QuizContent> &
        Partial<ActivityContent> &
        Partial<DeckContent>)
    | null;
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

/** Authenticated URLs for a rendered .pptx -- fetch via `downloadFile` (a plain
 *  <a href> can't send the bearer header). */
export const modulePptUrl = (moduleId: string, artifactId: string) =>
  `${API_BASE_URL}/modules/${moduleId}/artifacts/${artifactId}/pptx`;
export const libraryPptUrl = (presentationId: string) =>
  `${API_BASE_URL}/library/presentations/${presentationId}/pptx`;

// --- curated presentation library ---

export type LibraryPresentationItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  language: string;
  grade_label: string | null;
  subject_name: string | null;
  chapter_title: string | null;
  slide_count: number | null;
  updated_at: string;
};

export type LibraryPresentationDetail = LibraryPresentationItem & {
  tags: string[] | null;
  spec: DeckContent | null;
};

export const listLibraryPresentations = (
  token: string | null,
  filter: {
    gradeId?: string;
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
    language?: string;
    q?: string;
    limit?: number;
  } = {},
) => {
  const qs = new URLSearchParams();
  if (filter.gradeId) qs.set("grade_id", filter.gradeId);
  if (filter.subjectId) qs.set("subject_id", filter.subjectId);
  if (filter.chapterId) qs.set("chapter_id", filter.chapterId);
  if (filter.topicId) qs.set("topic_id", filter.topicId);
  if (filter.language) qs.set("language", filter.language);
  if (filter.q) qs.set("q", filter.q);
  if (filter.limit) qs.set("limit", String(filter.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return json<LibraryPresentationItem[]>(
    apiFetch(`/library/presentations${suffix}`, { token }),
  );
};

export const getLibraryPresentation = (token: string | null, id: string) =>
  json<LibraryPresentationDetail>(
    apiFetch(`/library/presentations/${id}`, { token }),
  );

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

export type PrincipalStats = { teachers: number; pending_teachers: number };

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
// Content generation (Medha v2 -- docs/medha-v2-backend.md). Streaming
// creation (`POST /generate/{type}`) goes through `lib/sse.ts`'s
// `streamGeneration`, not here -- these are the plain-fetch CRUD calls.
// ---------------------------------------------------------------------------

export type GenerationScope = {
  grade_id: string;
  subject_id: string;
  chapter_id?: string | null;
  topic_id?: string | null;
};

export type GenerationListItem = {
  id: string;
  type: GenerationType;
  title: string;
  status: "queued" | "running" | "completed" | "failed";
  source: string;
  is_favorite: boolean;
  grade_label: string | null;
  subject_name: string | null;
  chapter_title: string | null;
  created_at: string;
  legacy: boolean;
  module_id: string | null;
};

export type GenerationExportInfo = { format: string; status: string; ready: boolean };

export type GenerationDetail = {
  id: string;
  type: GenerationType;
  title: string;
  description: string | null;
  language: string;
  status: "queued" | "running" | "completed" | "failed";
  source: string;
  is_favorite: boolean;
  grade_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  grade_label: string | null;
  subject_name: string | null;
  chapter_title: string | null;
  input_params: Record<string, unknown> | null;
  content_json: unknown;
  error_message: string | null;
  session_id: string | null;
  parent_generation_id: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
  feedback: Feedback | null;
  exports: GenerationExportInfo[];
};

export const listGenerations = (
  token: string | null,
  filter: {
    type?: GenerationType;
    favorite?: boolean;
    q?: string;
    cursor?: string;
    limit?: number;
    sort?: "date" | "title";
  } = {},
) => {
  const qs = new URLSearchParams();
  if (filter.type) qs.set("type", filter.type);
  if (filter.favorite) qs.set("favorite", "true");
  if (filter.q) qs.set("q", filter.q);
  if (filter.cursor) qs.set("cursor", filter.cursor);
  if (filter.limit) qs.set("limit", String(filter.limit));
  if (filter.sort) qs.set("sort", filter.sort);
  const suffix = qs.toString() ? `?${qs}` : "";
  return json<GenerationListItem[]>(apiFetch(`/generations${suffix}`, { token }));
};

export const getGeneration = (token: string | null, id: string) =>
  json<GenerationDetail>(apiFetch(`/generations/${id}`, { token }));

export const patchGeneration = (
  token: string | null,
  id: string,
  body: { is_favorite?: boolean; title?: string },
) => json<GenerationDetail>(apiFetch(`/generations/${id}`, { method: "PATCH", token, body }));

export const deleteGeneration = async (token: string | null, id: string) => {
  const res = await apiFetch(`/generations/${id}`, { method: "DELETE", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

export const sendGenerationFeedback = (
  token: string | null,
  id: string,
  body: { rating: 1 | -1; comment?: string | null },
) => json<Feedback>(apiFetch(`/generations/${id}/feedback`, { method: "POST", token, body }));

/** Authenticated export URL -- fetch via `downloadFile` (see lib/download.ts). */
export const generationExportUrl = (id: string, format: string) =>
  `${API_BASE_URL}/generations/${id}/export/${format}`;

/** The body for `POST /generate/{type}` and `.../regenerate`, streamed via
 * `streamGeneration` in lib/sse.ts. */
export type GenerateBody<T extends GenerationType = GenerationType> = {
  scope: GenerationScope;
  params: Partial<ParamsFor<T>>;
  language?: string | null;
};

