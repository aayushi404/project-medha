const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Role = "admin" | "principal" | "teacher";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Teacher = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  approval_status: ApprovalStatus;
  school_id: string | null;
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
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && typeof data.detail[0]?.msg === "string") {
      return data.detail[0].msg as string;
    }
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
  topic_id: string | null;
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
  filter: { gradeId?: string; subjectId?: string } = {},
) => {
  const qs = new URLSearchParams();
  if (filter.gradeId) qs.set("grade_id", filter.gradeId);
  if (filter.subjectId) qs.set("subject_id", filter.subjectId);
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
