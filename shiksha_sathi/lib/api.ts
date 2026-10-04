import type { AnswerKey, GenerationType, ParamsFor } from "@/lib/generation-types";

// In production the browser talks to the backend through this site's own
// /api path (proxied to NEXT_PUBLIC_API_URL by a rewrite in next.config.ts).
// Same-origin means the refresh cookie is first-party, so browsers that block
// third-party cookies (Safari/iOS, privacy modes) no longer log people out on
// every reload, and no CORS preflight is needed.
const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "/api"
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

export type Role = "admin" | "principal" | "teacher" | "student";
export type ApprovalStatus = "pending" | "approved" | "rejected";

/** The portal a login comes from: a tab on /login, or "admin" from /admin/login. */
export type LoginRole = Role;

export type Teacher = {
  id: string;
  email: string | null;
  full_name: string;
  role: "admin" | "principal" | "teacher";
  approval_status: ApprovalStatus;
  school_id: string | null;
  onboarded_at: string | null;
  photo_url: string | null;
};

/** A student's login identity -- a separate table/type from `Teacher`, with
 * its own grade/roll placement. See lib/auth-context.tsx for the current-user
 * shape this feeds into. */
export type Student = {
  id: string;
  email: string | null;
  full_name: string;
  role: "student";
  approval_status: ApprovalStatus;
  school_id: string;
  grade_id: string | null;
  roll_number: string | null;
  photo_url: string | null;
};

/** The logged-in user, whichever table they're a row of -- narrow on `role`. */
export type CurrentUser = Teacher | Student;

export type TokenOut = {
  access_token: string;
  expires_in: number;
};

/**
 * Raised by the auth-context `login()` when the backend rejects an otherwise
 * valid credential. `code` is the backend's machine-readable reason
 * (`PENDING_APPROVAL` | `REGISTRATION_REJECTED` | `ROLE_MISMATCH`).
 * `actualRole` is only set for `ROLE_MISMATCH` -- the account's real role, so
 * the login screen can point back to the right tab.
 */
export class AuthError extends Error {
  code: string;
  reason: string | null;
  actualRole: Role | null;

  constructor(
    code: string,
    message: string,
    reason: string | null = null,
    actualRole: Role | null = null,
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.reason = reason;
    this.actualRole = actualRole;
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
/**
 * Set by the AuthProvider: refreshes the session and resolves to the new
 * access token (or null if the session is really gone). Lets apiFetch recover
 * from a 401 caused by an expired token -- e.g. after the laptop slept and the
 * proactive refresh timer never fired -- with one transparent retry.
 */
let tokenRefresher: (() => Promise<string | null>) | null = null;
export function setTokenRefresher(fn: (() => Promise<string | null>) | null) {
  tokenRefresher = fn;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const res = await rawFetch(path, options);
  if (res.status === 401 && options.token && tokenRefresher && !path.startsWith("/auth/")) {
    const fresh = await tokenRefresher();
    if (fresh) return rawFetch(path, { ...options, token: fresh });
  }
  return res;
}

function rawFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { method = "GET", body, token, signal } = options;
  // A FormData body (file uploads) must keep its own multipart Content-Type
  // (with the boundary the browser generates) -- setting it ourselves or
  // JSON.stringify-ing the body would corrupt the upload.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  // The auth endpoints that rely on the httpOnly refresh cookie (refresh /
  // logout) reject requests without this header. A cross-site attacker page
  // can't add it without a CORS preflight that only this origin passes -- that
  // is what makes the cookie-authenticated calls CSRF-safe.
  if (path.startsWith("/auth/")) headers["X-Medha-Client"] = "web";

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    // API responses carry no cache headers; never let the browser serve a
    // stale body (e.g. /auth/me after the profile changed server-side).
    cache: "no-store",
    signal,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
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
  photo_url: string | null;
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

/** Uploads (or replaces) the current user's profile photo -- works for a
 * teacher/principal or a student token alike, since the backend resolves the
 * actor from the token. Returns the updated profile (teacher shape); callers
 * that only need the photo can just read `.photo_url` off the result. */
export const uploadProfilePhoto = (token: string | null, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return json<Profile>(apiFetch("/profile/photo", { method: "POST", token, body: formData }));
};

export const deleteProfilePhoto = (token: string | null) =>
  json<Profile>(apiFetch("/profile/photo", { method: "DELETE", token }));

export const getGrades = () => json<Grade[]>(apiFetch("/reference/grades"));
export const getSubjects = () => json<Subject[]>(apiFetch("/reference/subjects"));

export const getChapters = (gradeId: string, subjectId: string) =>
  json<Chapter[]>(
    apiFetch(`/curriculum/chapters?grade_id=${encodeURIComponent(gradeId)}&subject_id=${encodeURIComponent(subjectId)}`),
  );

export const getTopics = (chapterId: string) =>
  json<Topic[]>(apiFetch(`/curriculum/topics?chapter_id=${encodeURIComponent(chapterId)}`));

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
  /** Required for principals. Optional for teachers, who log in by mobile number. */
  email?: string | null;
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

// --- phone login: the student profile picker ---
// Only what the picker shows. The backend returns no guardian data and no emails.

export type StudentProfileSummary = {
  id: string;
  full_name: string;
  class_label: string | null;
  roll_number: string | null;
};

/** Every student profile on one phone number (siblings share it). Empty when
 * the number has none. Throttled per IP and per phone on the server. */
export const lookupStudentProfiles = (phone: string) =>
  json<{ profiles: StudentProfileSummary[] }>(
    apiFetch("/auth/student/lookup", { method: "POST", body: { phone } }),
  ).then((r) => r.profiles);

// --- admin ---

export type AdminStats = {
  schools: number;
  districts: number;
  principals: number;
  teachers: number;
  students: number;
  pending_principals: number;
  schools_without_principal: number;
  attendance_today_pct: number | null;
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

export type PrincipalListItem = {
  id: string;
  full_name: string;
  email: string | null;
  mobile_number: string | null;
  qualification: string | null;
  school_id: string | null;
  school_name: string | null;
  district_name: string | null;
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  email_verified: boolean;
  applied_at: string;
  decided_at: string | null;
};

export type SchoolPrincipalStatus = {
  school_id: string;
  school_name: string;
  district_name: string;
  principal_name: string | null;
  principal_email: string | null;
  principal_status: ApprovalStatus | null;
  teacher_count: number;
  student_count: number;
};

export type SchoolStaffMember = {
  id: string;
  full_name: string;
  email: string | null;
  role: "principal" | "teacher";
  approval_status: ApprovalStatus;
  qualification: string | null;
};

export type SchoolDetail = {
  school_id: string;
  school_name: string;
  udise_code: string | null;
  school_type: string | null;
  medium_of_instruction: string;
  district_name: string;
  block_name: string | null;
  class_count: number;
  student_count: number;
  pending_student_count: number;
  attendance_today_pct: number | null;
  staff: SchoolStaffMember[];
};

export type DistrictSummary = {
  district_id: string;
  district_name: string;
  schools: number;
  schools_without_principal: number;
  teachers: number;
  students: number;
  pending_principals: number;
};

export type AdminActivityItem = {
  id: string;
  action: "approved" | "rejected" | "revoked";
  subject_name: string;
  subject_role: "principal" | "teacher" | "student";
  actor_name: string;
  school_name: string | null;
  reason: string | null;
  created_at: string;
};

export type ApprovalResult = { id: string; approval_status: ApprovalStatus };

export const getAdminStats = (token: string | null) =>
  json<AdminStats>(apiFetch("/admin/stats", { token }));

export const getPendingPrincipals = (token: string | null) =>
  json<PendingPrincipal[]>(apiFetch("/admin/principals/pending", { token }));

export const getAdminPrincipals = (
  token: string | null,
  opts: { status?: ApprovalStatus; q?: string } = {},
) => {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("approval_status", opts.status);
  if (opts.q?.trim()) qs.set("q", opts.q.trim());
  const suffix = qs.toString() ? `?${qs}` : "";
  return json<PrincipalListItem[]>(apiFetch(`/admin/principals${suffix}`, { token }));
};

export const getAdminSchools = (
  token: string | null,
  opts: { q?: string; districtId?: string } = {},
) => {
  const qs = new URLSearchParams();
  if (opts.q?.trim()) qs.set("q", opts.q.trim());
  if (opts.districtId) qs.set("district_id", opts.districtId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return json<SchoolPrincipalStatus[]>(apiFetch(`/admin/schools${suffix}`, { token }));
};

export const getAdminSchool = (token: string | null, schoolId: string) =>
  json<SchoolDetail>(apiFetch(`/admin/schools/${schoolId}`, { token }));

export const getAdminDistricts = (token: string | null) =>
  json<DistrictSummary[]>(apiFetch("/admin/districts", { token }));

export const getAdminActivity = (token: string | null, limit = 50) =>
  json<AdminActivityItem[]>(apiFetch(`/admin/activity?limit=${limit}`, { token }));

export const approvePrincipal = (token: string | null, id: string) =>
  json<ApprovalResult>(
    apiFetch(`/admin/principals/${id}/approve`, { method: "POST", token }),
  );

export const rejectPrincipal = (token: string | null, id: string, reason: string) =>
  json<ApprovalResult>(
    apiFetch(`/admin/principals/${id}/reject`, { method: "POST", token, body: { reason } }),
  );

export const revokePrincipal = (token: string | null, id: string, reason: string) =>
  json<ApprovalResult>(
    apiFetch(`/admin/principals/${id}/revoke`, { method: "POST", token, body: { reason } }),
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
  photo_url: string | null;
  primary_subject_name: string | null;
  classes_count: number;
  class_teacher_of_section_id: string | null;
  class_teacher_of_label: string | null;
};

export type TeacherProfile = {
  id: string;
  full_name: string;
  email: string | null;
  mobile_number: string | null;
  employee_code: string | null;
  years_of_experience: number | null;
  qualification: string | null;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  photo_url: string | null;
  sections_taught: string[];
};

export const getPrincipalStats = (token: string | null) =>
  json<PrincipalStats>(apiFetch("/principal/stats", { token }));

export const getPrincipalTeachers = (token: string | null) =>
  json<TeacherRosterItem[]>(apiFetch("/principal/teachers", { token }));

export const getTeacherProfile = (token: string | null, teacherId: string) =>
  json<TeacherProfile>(apiFetch(`/principal/teachers/${teacherId}`, { token }));

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

// --- principal: class sections / student directory ---
// A separate domain from `StudentRosterItem` above: that's the login-capable
// `teachers` role='student' roster; this is the principal-managed school
// records roster (admission no., guardian contact), independent of login.

export type ClassSectionSummary = {
  id: string;
  grade_label: string;
  section: string;
  academic_year_label: string;
  student_count: number;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
};

export type RosterStudentItem = {
  id: string;
  roll_number: number | null;
  full_name: string;
  guardian_name: string | null;
  photo_url: string | null;
};

/** The one student profile, for teachers and the principal (GET /students/{id}).
 * `viewer` lists the actions this caller may take; the screen shows only those. */
export type StudentProfile = {
  id: string;
  full_name: string;
  photo_url: string | null;
  approval_status: ApprovalStatus;
  status: string;
  login_phone: string | null;
  email: string | null;
  class_section_id: string | null;
  grade_label: string | null;
  section: string | null;
  roll_number: number | null;
  academic_year_label: string | null;
  class_teacher_name: string | null;
  approved_at: string | null;
  guardian_name: string | null;
  guardian_relation: string | null;
  guardian_phone: string | null;
  viewer: {
    can_approve: boolean;
    can_reject: boolean;
    can_reset_login: boolean;
  };
};

export const getClassSections = (token: string | null, academicYearId?: string | null) =>
  json<ClassSectionSummary[]>(
    apiFetch(
      `/principal/sections${academicYearId ? `?academic_year_id=${encodeURIComponent(academicYearId)}` : ""}`,
      { token },
    ),
  );

export const getClassSection = (token: string | null, sectionId: string) =>
  json<ClassSectionSummary>(apiFetch(`/principal/sections/${sectionId}`, { token }));

export const getSectionRoster = (token: string | null, sectionId: string) =>
  json<RosterStudentItem[]>(apiFetch(`/principal/sections/${sectionId}/students`, { token }));

export const getStudentProfile = (token: string | null, studentId: string) =>
  json<StudentProfile>(apiFetch(`/students/${studentId}`, { token }));

// --- principal: school setup (academic years, class sections, teaching assignments) ---

export type AcademicYear = {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

export type AcademicYearCreateInput = {
  label: string;
  starts_on: string;
  ends_on: string;
  set_current?: boolean;
};

export type ClassSectionCreateInput = {
  grade_id: string;
  section?: string;
  academic_year_id?: string | null;
};
export type ClassSectionUpdateInput = { class_teacher_id: string | null };

export type TeachingAssignment = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  class_section_id: string;
  grade_label: string;
  section: string;
  subject_id: string;
  subject_name: string;
};

export type TeachingAssignmentInput = {
  teacher_id: string;
  class_section_id: string;
  subject_id: string;
};

export const getAcademicYears = (token: string | null) =>
  json<AcademicYear[]>(apiFetch("/principal/academic-years", { token }));

export const createAcademicYear = (token: string | null, input: AcademicYearCreateInput) =>
  json<AcademicYear>(
    apiFetch("/principal/academic-years", { method: "POST", token, body: input }),
  );

export const createClassSection = (token: string | null, input: ClassSectionCreateInput) =>
  json<ClassSectionSummary>(
    apiFetch("/principal/sections", { method: "POST", token, body: input }),
  );

export const updateClassSection = (
  token: string | null,
  sectionId: string,
  input: ClassSectionUpdateInput,
) =>
  json<ClassSectionSummary>(
    apiFetch(`/principal/sections/${sectionId}`, { method: "PATCH", token, body: input }),
  );

export const getSectionTeachingAssignments = (token: string | null, sectionId: string) =>
  json<TeachingAssignment[]>(
    apiFetch(`/principal/sections/${sectionId}/teaching-assignments`, { token }),
  );

export const createTeachingAssignment = (token: string | null, input: TeachingAssignmentInput) =>
  json<TeachingAssignment>(
    apiFetch("/principal/teaching-assignments", { method: "POST", token, body: input }),
  );

export const deleteTeachingAssignment = async (token: string | null, assignmentId: string) => {
  const res = await apiFetch(`/principal/teaching-assignments/${assignmentId}`, {
    method: "DELETE",
    token,
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

/** Assign, change, or clear (teacherId=null) the one teacher who teaches a
 * subject in a class section -- one atomic call, returns the section's full
 * updated assignment list. */
export const setSubjectTeacher = (
  token: string | null,
  sectionId: string,
  subjectId: string,
  teacherId: string | null,
) =>
  json<TeachingAssignment[]>(
    apiFetch(`/principal/sections/${sectionId}/subjects/${subjectId}/teacher`, {
      method: "PUT",
      token,
      body: { teacher_id: teacherId },
    }),
  );

// ---------------------------------------------------------------------------
// Student self-registration. One step: pick school + grade + class_section +
// roll number (for the current academic year), give guardian details, set a
// login credential -- a teacher still has to approve the row, but there's no
// separate "activate account" step anymore.
// ---------------------------------------------------------------------------

export type ClassSectionOption = { id: string; section: string };

/** Unauthenticated -- used by the registration form before any login
 * exists. Distinct from `getClassSections` above (principal-side, current
 * user's own school). Empty result means the school hasn't set up this
 * grade yet; the caller must block registration, not fall back. */
export const getRegistrationClassSections = (schoolId: string, gradeId: string) =>
  json<ClassSectionOption[]>(
    apiFetch(`/reference/class-sections?school_id=${encodeURIComponent(schoolId)}&grade_id=${encodeURIComponent(gradeId)}`),
  );

export type GuardianRelation = "father" | "mother" | "guardian";

export type StudentRegisterInput = {
  full_name: string;
  school_id: string;
  class_section_id: string;
  roll_number: number;
  guardian_name: string;
  guardian_relation: GuardianRelation;
  guardian_phone: string;
  /** The number the student logs in with. Email is optional and not sent. */
  login_phone: string;
  password: string;
};

export type StudentRegisterResult = { status: "pending"; message: string };

export type StudentClaimInput = {
  school_id: string;
  class_section_id: string;
  roll_number: number;
  full_name: string;
  /** Must match the number the school recorded, if it recorded one. */
  login_phone: string;
  password: string;
};

/** Sets a login on a profile a principal imported (no password yet). */
export const claimStudentAccount = (input: StudentClaimInput) =>
  json<{ status: "claimed"; message: string }>(
    apiFetch("/student/claim", { method: "POST", body: input }),
  );

export const registerStudent = (input: StudentRegisterInput) =>
  json<StudentRegisterResult>(
    apiFetch("/student/register", { method: "POST", body: input }),
  );

// --- teacher-facing student approvals ---

export type TeacherStudentStats = { students: number; pending_students: number };

export type PendingStudent = {
  id: string;
  full_name: string;
  class_section_id: string;
  grade_id: string;
  grade_label: string;
  section: string;
  roll_number: number | null;
  login_phone: string | null;
  applied_at: string;
};

export type StudentRosterItem = {
  id: string;
  full_name: string;
  class_section_id: string;
  grade_id: string;
  grade_label: string;
  section: string;
  roll_number: number | null;
  /** the number the student logs in with. Lists carry no email; the profile does. */
  login_phone: string | null;
  approved_at: string | null;
  photo_url: string | null;
};

/** A class_section the calling teacher can act on -- via a teaching
 * assignment or being its class_teacher. Feeds the class picker on
 * attendance/homework/report-card/OMR/notifications pages, replacing the
 * old flat grade picker on each of those. */
export type TeacherSectionSubject = { id: string; name: string };

export type TeacherSection = {
  id: string;
  grade_id: string;
  grade_label: string;
  section: string;
  academic_year_label: string;
  is_class_teacher: boolean;
  subjects: TeacherSectionSubject[];
  /** approved and pending students in this class (current year) */
  students: number;
  pending_students: number;
};

function classQuery(classSectionId?: string | null): string {
  return classSectionId ? `?class_section_id=${encodeURIComponent(classSectionId)}` : "";
}

export const getMySections = (token: string | null) =>
  json<TeacherSection[]>(apiFetch("/teacher/sections", { token }));

export const getTeacherStudentStats = (token: string | null) =>
  json<TeacherStudentStats>(apiFetch("/teacher/students/stats", { token }));

/** Pending registrations in the teacher's classes, or in one class. */
export const getPendingStudents = (token: string | null, classSectionId?: string | null) =>
  json<PendingStudent[]>(
    apiFetch(`/teacher/students/pending${classQuery(classSectionId)}`, { token }),
  );

/** Approved students in the teacher's classes, or in one class. */
export const getStudentRoster = (token: string | null, classSectionId?: string | null) =>
  json<StudentRosterItem[]>(apiFetch(`/teacher/students${classQuery(classSectionId)}`, { token }));

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
  body: { is_favorite?: boolean; title?: string; content_json?: unknown },
) => json<GenerationDetail>(apiFetch(`/generations/${id}`, { method: "PATCH", token, body }));

export const deleteGeneration = async (token: string | null, id: string) => {
  const res = await apiFetch(`/generations/${id}`, { method: "DELETE", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

/** Fresh LLM-built marking key for a question paper. Pass the current
 * (possibly edited) `content_json` so the key matches what's on screen. */
export const generateAnswerKey = (
  token: string | null,
  id: string,
  content_json?: unknown,
) =>
  json<AnswerKey>(
    apiFetch(`/generations/${id}/answer-key`, {
      method: "POST",
      token,
      body: { content_json: content_json ?? null },
    }),
  );

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
  class_section_id?: string;
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
// Homework: a teacher assigns to a class_section they teach a subject in;
// students see their own list and toggle done/not-done.
// ---------------------------------------------------------------------------

export type HomeworkListItem = {
  id: string;
  title: string;
  grade_label: string;
  section: string;
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
  section: string;
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
  class_section_id: string;
  subject_id: string;
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
  json<Timetable>(apiFetch(`/timetable?grade_id=${encodeURIComponent(gradeId)}`, { token }));

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

export type StudentMarkItemInput = {
  student_id: string;
  marks_obtained: number;
  remarks?: string | null;
};

export type BulkReportCardMarksInput = {
  class_section_id: string;
  subject_id: string;
  term: string;
  max_marks: number;
  marks: StudentMarkItemInput[];
};

export type BulkReportCardMarksResult = {
  saved_count: number;
  marks: ReportCardMark[];
};

export type OMRUploadResult = {
  file_name: string;
  file_size_bytes: number;
  status: string;
  message: string;
};

export type BubbleScore = {
  digit: number;
  fill_ratio: number;
  is_filled: boolean;
};

export type DigitEvaluation = {
  place: "hundreds" | "tens" | "units";
  selected_digit: number | null;
  confidence: number;
  status: "valid" | "ambiguous" | "missing";
  scores: BubbleScore[];
};

export type StudentOMRResult = {
  roll_number: number;
  student_id: string | null;
  student_name: string | null;
  hundreds: number | null;
  tens: number | null;
  units: number | null;
  detected_marks: number | null;
  max_marks: number;
  status: "valid" | "ambiguous" | "missing" | "invalid_max";
  confidence: number;
  issues: string[];
  digit_evaluations: {
    hundreds?: DigitEvaluation;
    tens?: DigitEvaluation;
    units?: DigitEvaluation;
  };
};

export type OMRPipelineSummary = {
  total_rows: number;
  valid_count: number;
  needs_review_count: number;
  missing_count: number;
};

export type OMREvaluationResult = {
  processed: boolean;
  page_count: number;
  summary: OMRPipelineSummary;
  results: StudentOMRResult[];
  debug_job_id?: string | null;
  message: string;
};

export const upsertReportCardMark = (token: string | null, body: ReportCardMarkInput) =>
  json<ReportCardMark>(apiFetch("/report-card/marks", { method: "POST", token, body }));

export const bulkUpsertReportCardMarks = (
  token: string | null,
  body: BulkReportCardMarksInput
) =>
  json<BulkReportCardMarksResult>(
    apiFetch("/report-card/bulk-marks", { method: "POST", token, body })
  );

export const getClassReportCardMarks = (
  token: string | null,
  classSectionId: string,
  subjectId: string,
  term: string
) =>
  json<ReportCardMark[]>(
    apiFetch(
      `/report-card/class-marks?class_section_id=${encodeURIComponent(classSectionId)}&subject_id=${encodeURIComponent(subjectId)}&term=${encodeURIComponent(term)}`,
      { token }
    )
  );

export const uploadOMRSheet = async (token: string | null, file: File): Promise<OMRUploadResult> => {
  const formData = new FormData();
  formData.append("file", file);
  return json<OMRUploadResult>(
    apiFetch("/report-card/omr/upload", {
      method: "POST",
      token,
      body: formData,
    })
  );
};

export const evaluateOMRSheet = async (
  token: string | null,
  file: File,
  classSectionId: string,
  maxMarks: number = 100
): Promise<OMREvaluationResult> => {
  const formData = new FormData();
  formData.append("file", file);
  return json<OMREvaluationResult>(
    apiFetch(`/report-card/omr/evaluate?class_section_id=${encodeURIComponent(classSectionId)}&max_marks=${encodeURIComponent(String(maxMarks))}`, {
      method: "POST",
      token,
      body: formData,
    })
  );
};

export const getReportCard = (token: string | null, studentId: string) =>
  json<ReportCard>(apiFetch(`/report-card/${studentId}`, { token }));

export const deleteReportCardMark = (
  token: string | null,
  studentId: string,
  subjectId: string,
  term: string
) =>
  apiFetch(`/report-card/marks/${studentId}/${subjectId}/${encodeURIComponent(term)}`, {
    method: "DELETE",
    token,
  });



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
  return json<LibraryItem[]>(apiFetch(`/library/items${suffix}`, { token }));
};

export const addLibraryItem = (token: string | null, body: LibraryItemInput) =>
  json<LibraryItem>(apiFetch("/library/items", { method: "POST", token, body }));

export const deleteLibraryItem = async (token: string | null, id: string) => {
  const res = await apiFetch(`/library/items/${id}`, { method: "DELETE", token });
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

/** Find a student of this school by name, email or login phone (at most 25). */
export const searchPrincipalStudents = (token: string | null, query: string) => {
  const qs = new URLSearchParams({ q: query });
  return json<StudentRosterItem[]>(apiFetch(`/principal/students/search?${qs}`, { token }));
};

// --- principal: bulk-create student accounts from a CSV ---

/** One parsed CSV row. `line` is its line number in the file, for messages. */
export type StudentImportRow = {
  line: number;
  full_name: string | null;
  grade: string | null;
  section: string | null;
  roll_number: string | null;
  login_phone: string | null;
  password: string | null; // the student's login password, chosen by the principal
  email: string | null;
  guardian_name: string | null;
  guardian_relation: string | null;
  guardian_phone: string | null;
};

export type StudentImportRowStatus = "ready" | "created" | "exists" | "error";

export type StudentImportRowResult = {
  line: number;
  status: StudentImportRowStatus;
  message: string | null;
  full_name: string | null;
  class_label: string | null; // e.g. "Class 8 · A"
  roll_number: number | null;
  email: string | null; // contact only
  student_id: string | null; // set once created; links to the profile
};

export type StudentImportResult = {
  dry_run: boolean;
  total: number;
  ready: number;
  created: number;
  exists: number;
  errors: number;
  new_sections: string[]; // sections that will be / were created
  academic_year_label: string;
  rows: StudentImportRowResult[];
};

/** Must match MAX_IMPORT_ROWS in backend/principal/schemas.py. */
export const MAX_STUDENT_IMPORT_ROWS = 2000;

/** One student from the Admission form. Same fields as a CSV row, no line. */
export type StudentAdmissionInput = Omit<StudentImportRow, "line">;

/** Admit one student. Approved at once; they log in with phone + password. */
export const admitStudent = (token: string | null, input: StudentAdmissionInput) =>
  json<StudentImportRowResult>(
    apiFetch("/principal/students/admit", {
      method: "POST",
      token,
      body: input,
    }),
  );

/** `dryRun: true` validates and previews; `false` admits the students. */
export const importStudents = (
  token: string | null,
  rows: StudentImportRow[],
  dryRun: boolean,
) =>
  json<StudentImportResult>(
    apiFetch("/principal/students/import", {
      method: "POST",
      token,
      body: { rows, dry_run: dryRun },
    }),
  );

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
  json<ChapterNote | null>(apiFetch(`/notes?chapter_id=${encodeURIComponent(chapterId)}`, { token }));

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
  json<PracticeQuestion[]>(apiFetch(`/practice?chapter_id=${encodeURIComponent(chapterId)}`, { token }));

export const addPracticeQuestion = (token: string | null, body: PracticeQuestionInput) =>
  json<PracticeQuestion>(apiFetch("/practice", { method: "POST", token, body }));

export const deletePracticeQuestion = async (token: string | null, id: string) => {
  const res = await apiFetch(`/practice/${id}`, { method: "DELETE", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

// ---------------------------------------------------------------------------
// Attendance: a teacher marks present/absent for their school's approved
// roster in one grade at a time; a student sees their own history.
// ---------------------------------------------------------------------------

export type AttendanceStatus = "present" | "absent";

export type AttendanceStudent = {
  student_id: string;
  full_name: string;
  roll_number: number | null;
  photo_url: string | null;
  status: AttendanceStatus | null; // null = not yet marked for this date
};

export type AttendanceDay = {
  class_section_id: string;
  grade_label: string;
  section: string;
  date: string;
  students: AttendanceStudent[];
};

export type AttendanceRecordInput = { student_id: string; status: AttendanceStatus };

export const getAttendance = (token: string | null, classSectionId: string, date?: string) => {
  const qs = new URLSearchParams({ class_section_id: classSectionId });
  if (date) qs.set("date", date);
  return json<AttendanceDay>(apiFetch(`/attendance?${qs}`, { token }));
};

export const markAttendance = (
  token: string | null,
  body: { class_section_id: string; date: string; records: AttendanceRecordInput[] },
) => json<AttendanceDay>(apiFetch("/attendance", { method: "POST", token, body }));

export type AttendanceMineItem = { date: string; status: AttendanceStatus };

export const getMyAttendance = (token: string | null) =>
  json<AttendanceMineItem[]>(apiFetch("/attendance/mine", { token }));

// --- principal: real school-wide attendance stats (replaces the old
// localStorage-mocked numbers on the dashboard) ---

export type ClassAttendanceSummary = {
  class_section_id: string;
  grade_label: string;
  section: string;
  class_teacher_name: string | null;
  total_students: number;
  present_count: number;
  absent_count: number;
  unmarked_count: number;
  percentage: number | null; // null when the section has no students
};

export type SchoolAttendanceSummary = {
  date: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  unmarked_count: number;
  percentage: number | null;
  classes: ClassAttendanceSummary[];
};

export const getPrincipalAttendanceSummary = (token: string | null, date?: string) => {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return json<SchoolAttendanceSummary>(apiFetch(`/principal/attendance/summary${qs}`, { token }));
};

// ---------------------------------------------------------------------------
// Absence calling: the instant an absent mark is saved, the backend queues an
// AI phone call to the guardian asking why -- this just reads back the
// outcome log (see backend/src/backend/absence_calls/).
// ---------------------------------------------------------------------------

export type AbsenceCallStatus =
  | "queued"
  | "no_guardian_phone"
  | "not_configured"
  | "dialing"
  | "ringing"
  | "in_progress"
  | "completed"
  | "no_answer"
  | "failed";

export type AbsenceCall = {
  id: string;
  student_id: string;
  student_name: string;
  guardian_phone: string | null;
  status: AbsenceCallStatus;
  reason_text: string | null;
  failure_reason: string | null;
  transcript: string | null;
  attendance_date: string;
  created_at: string;
  completed_at: string | null;
};

export const getAbsenceCalls = (token: string | null, classSectionId?: string) => {
  const qs = classSectionId ? `?class_section_id=${encodeURIComponent(classSectionId)}` : "";
  return json<AbsenceCall[]>(apiFetch(`/absence-calls${qs}`, { token }));
};


// ---------------------------------------------------------------------------
// Account recovery + email verification (all public; the backend answers
// forgot/resend identically whether or not the email exists).
// ---------------------------------------------------------------------------

async function postAuth(path: string, body: unknown): Promise<string> {
  const res = await apiFetch(path, { method: "POST", body });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  const data = (await res.json()) as { message?: string };
  return data.message ?? "";
}

export const verifyEmail = (token: string) => postAuth("/auth/verify-email", { token });
export const resendVerification = (email: string) => postAuth("/auth/resend-verification", { email });
export const forgotPassword = (email: string) => postAuth("/auth/forgot-password", { email });
export const resetPassword = (token: string, newPassword: string) =>
  postAuth("/auth/reset-password", { token, new_password: newPassword });

// --- staff-issued reset codes (teachers and students; no SMS yet) ---
// The principal issues a teacher's code, and the teacher issues a student's
// code. The code is shown once, on the staff screen, and works once for 15 min.

export type ResetCodeIssued = { code: string; expires_at: string; full_name: string };

export const issueTeacherResetCode = (token: string | null, teacherId: string) =>
  json<ResetCodeIssued>(apiFetch(`/principal/teachers/${teacherId}/reset-code`, { method: "POST", token }));

export const issueStudentResetCode = (token: string | null, studentId: string) =>
  json<ResetCodeIssued>(apiFetch(`/teacher/students/${studentId}/reset-code`, { method: "POST", token }));

export type ResetWithCodeInput = {
  phone: string;
  role: "teacher" | "student";
  /** Required for students: the profile the code was issued for. */
  student_id?: string;
  code: string;
  new_password: string;
};

export const resetWithCode = (input: ResetWithCodeInput) => postAuth("/auth/reset-with-code", input);

// --- principal: timetable planner (docs/phase-2/principal_timetable_planner.md) ---

export type PlannerPeriodSlot = {
  id: string;
  day_of_week: number;
  period_number: number;
  label: string | null;
  /** "HH:MM:SS" from the server; null for a break with no times */
  starts_at: string | null;
  ends_at: string | null;
  is_break: boolean;
};

export type PlannerPeriodSlotInput = {
  period_number: number;
  label?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_break?: boolean;
};

export type PlannerTimetable = {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  version: number;
  academic_year_id: string;
  academic_year_label: string;
};

export type PlannerTimetableListItem = PlannerTimetable & { cell_count: number };

export type PlannerSection = {
  id: string;
  /** "9 · A" */
  label: string;
  grade_label: string;
  section: string;
};

export type PlannerSubject = { id: string; name: string };

export type PlannerCell = {
  class_section_id: string;
  period_slot_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
};

export type PlannerEligibleTeacher = {
  teacher_id: string;
  name: string;
  tier: "assigned" | "qualified";
  periods_today: number;
  periods_week: number;
};

export type PlannerGrid = {
  timetable_id: string;
  name: string;
  status: PlannerTimetable["status"];
  editable: boolean;
  version: number;
  day_of_week: number;
  period_slots: PlannerPeriodSlot[];
  class_sections: PlannerSection[];
  subjects: PlannerSubject[];
  cells: PlannerCell[];
  /** keyed "<class_section_id>:<subject_id>" */
  eligible_teachers: Record<string, PlannerEligibleTeacher[]>;
};

export type PlannerCellInput = {
  class_section_id: string;
  period_slot_id: string;
  subject_id: string;
  teacher_id: string | null;
};

export type PlannerValidationItem = {
  day_of_week: number;
  period_number: number;
  class_label: string;
  subject_name: string | null;
};

export type PlannerValidation = {
  empty_slots: PlannerValidationItem[];
  no_teacher: PlannerValidationItem[];
  overloaded: {
    teacher_id: string;
    teacher_name: string;
    day_of_week: number;
    periods: number;
    cap: number;
  }[];
  daily_cap: number;
};

export type PlannerCopyDayResult = {
  grid: PlannerGrid;
  copied: number;
  skipped: number;
};

export const getPlannerSlots = (token: string | null, day: number) =>
  json<PlannerPeriodSlot[]>(apiFetch(`/principal/period-slots?day=${day}`, { token }));

export const savePlannerSlots = (
  token: string | null,
  day: number,
  slots: PlannerPeriodSlotInput[],
) =>
  json<PlannerPeriodSlot[]>(
    apiFetch(`/principal/period-slots?day=${day}`, { method: "PUT", token, body: { slots } }),
  );

export const copyPlannerSlots = (token: string | null, fromDay: number, toDays: number[]) =>
  json<{ copied_to: number[] }>(
    apiFetch("/principal/period-slots/copy", {
      method: "POST",
      token,
      body: { from_day: fromDay, to_days: toDays },
    }),
  );

export const getPlannerTimetables = (token: string | null) =>
  json<PlannerTimetableListItem[]>(apiFetch("/principal/timetables", { token }));

export const createPlannerTimetable = (
  token: string | null,
  input: { name: string; copy_from_id?: string | null },
) =>
  json<PlannerTimetable>(apiFetch("/principal/timetables", { method: "POST", token, body: input }));

export const getPlannerGrid = (token: string | null, timetableId: string, day: number) =>
  json<PlannerGrid>(
    apiFetch(`/principal/timetables/${timetableId}/grid?day=${day}`, { token }),
  );

export const savePlannerDay = (
  token: string | null,
  timetableId: string,
  day: number,
  input: { version: number; cells: PlannerCellInput[] },
) =>
  json<PlannerGrid>(
    apiFetch(`/principal/timetables/${timetableId}/days/${day}`, {
      method: "PUT",
      token,
      body: input,
    }),
  );

export const copyPlannerDay = (
  token: string | null,
  timetableId: string,
  day: number,
  source: number,
  version: number,
) =>
  json<PlannerCopyDayResult>(
    apiFetch(`/principal/timetables/${timetableId}/days/${day}/copy-from/${source}`, {
      method: "POST",
      token,
      body: { version },
    }),
  );

export const getPlannerValidation = (token: string | null, timetableId: string) =>
  json<PlannerValidation>(apiFetch(`/principal/timetables/${timetableId}/validate`, { token }));

export const publishPlannerTimetable = (token: string | null, timetableId: string, version: number) =>
  json<PlannerTimetable>(
    apiFetch(`/principal/timetables/${timetableId}/publish`, {
      method: "POST",
      token,
      body: { version },
    }),
  );

// --- principal: daily cover (docs/phase-2/principal_timetable_substitution_architecture.md) ---

export type CoverReason = "sick" | "leave" | "official_duty" | "training";

export type CoverAbsence = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  date: string;
  is_full_day: boolean;
  from_period_number: number | null;
  to_period_number: number | null;
  reason: string | null;
  note: string | null;
};

export type CoverSubstitution = {
  id: string;
  date: string;
  timetable_cell_id: string | null;
  status: "assigned" | "self_study" | "cancelled";
  substitute_teacher_id: string | null;
  substitute_teacher_name: string | null;
  note: string | null;
};

export type CoverCellState = "normal" | "needs_cover" | "covered" | "self_study" | "cancelled";

export type CoverCell = {
  timetable_cell_id: string;
  class_section_id: string;
  period_slot_id: string;
  subject_id: string;
  subject_name: string;
  original_teacher_id: string | null;
  original_teacher_name: string | null;
  state: CoverCellState;
  substitute: CoverSubstitution | null;
};

export type CoverCandidate = {
  teacher_id: string;
  name: string;
  photo_url: string | null;
  /** 1 reserve for this class, 2 teaches this subject, 3 free for supervision only */
  tier: number;
  teaches_subject: boolean;
  subjects: string[];
  periods_today: number;
  covers_today: number;
};

export type CoverUnavailable = {
  teacher_id: string;
  name: string;
  photo_url: string | null;
  reason: string;
};

export type CoverCandidates = {
  available: CoverCandidate[];
  unavailable: CoverUnavailable[];
};

export type CoverDayBoard = {
  date: string;
  day_of_week: number;
  timetable: { id: string; name: string } | null;
  summary: { absent_count: number; needs_cover: number; resolved: number };
  absences: CoverAbsence[];
  period_slots: PlannerPeriodSlot[];
  class_sections: PlannerSection[];
  cells: CoverCell[];
  /** keyed by timetable_cell_id, only for cells that need cover */
  candidates: Record<string, CoverCandidates>;
};

export type CoverSuggestionItem = {
  timetable_cell_id: string;
  class_section_id: string;
  period_slot_id: string;
  substitute_teacher_id: string | null;
  substitute_teacher_name: string | null;
  tier: number | null;
  reason: string | null;
};

export type CoverSuggestion = { items: CoverSuggestionItem[] };

export type CoverActionInput = {
  date: string;
  timetable_cell_id: string;
  action: "assign" | "self_study" | "cancel";
  substitute_teacher_id?: string | null;
  note?: string | null;
};

export type ReserveTeacher = {
  teacher_id: string;
  full_name: string;
  photo_url: string | null;
  primary_subject_name: string | null;
  classes_count: number;
};

export const getCoverDay = (token: string | null, date: string) =>
  json<CoverDayBoard>(apiFetch(`/principal/day?date=${encodeURIComponent(date)}`, { token }));

export const markCoverAbsence = (
  token: string | null,
  input: {
    teacher_id: string;
    dates: string[];
    is_full_day: boolean;
    from_period_number?: number | null;
    to_period_number?: number | null;
    reason?: CoverReason | null;
    note?: string | null;
  },
) =>
  json<{ absences: CoverAbsence[]; released: number }>(
    apiFetch("/principal/absences", { method: "POST", token, body: input }),
  );

/** Returns the status instead of throwing, because a 409 ("this absence has
 * covers, confirm") is an expected answer the screen handles. */
export async function unmarkCoverAbsence(
  token: string | null,
  absenceId: string,
  force: boolean,
): Promise<{ status: number; message: string }> {
  const res = await apiFetch(`/principal/absences/${absenceId}?force=${force}`, { method: "DELETE", token });
  if (res.ok) return { status: res.status, message: "" };
  return { status: res.status, message: await extractErrorMessage(res) };
}

export const applyCover = (token: string | null, input: CoverActionInput) =>
  json<CoverSubstitution>(apiFetch("/principal/substitutions", { method: "POST", token, body: input }));

export const applyCoverBulk = (token: string | null, date: string, items: CoverActionInput[]) =>
  json<CoverSubstitution[]>(
    apiFetch("/principal/substitutions/bulk", { method: "POST", token, body: { date, items } }),
  );

export const clearCover = async (token: string | null, substitutionId: string) => {
  const res = await apiFetch(`/principal/substitutions/${substitutionId}`, { method: "DELETE", token });
  if (!res.ok) throw new Error(await extractErrorMessage(res));
};

export const suggestCover = (token: string | null, date: string) =>
  json<CoverSuggestion>(
    apiFetch(`/principal/substitutions/suggest?date=${encodeURIComponent(date)}`, { method: "POST", token }),
  );

export const getReserveTeachers = (token: string | null, sectionId: string) =>
  json<ReserveTeacher[]>(apiFetch(`/principal/sections/${sectionId}/reserve-teachers`, { token }));

export const addReserveTeacher = (token: string | null, sectionId: string, teacherId: string) =>
  json<ReserveTeacher[]>(
    apiFetch(`/principal/sections/${sectionId}/reserve-teachers`, {
      method: "POST",
      token,
      body: { teacher_id: teacherId },
    }),
  );

export const removeReserveTeacher = (token: string | null, sectionId: string, teacherId: string) =>
  json<ReserveTeacher[]>(
    apiFetch(`/principal/sections/${sectionId}/reserve-teachers/${teacherId}`, {
      method: "DELETE",
      token,
    }),
  );

// --- the final timetable for a school day (teachers' board) ---

export type FinalDayPeriod = {
  id: string;
  period_number: number;
  label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_break: boolean;
};

export type FinalDayCell = {
  class_section_id: string;
  period_slot_id: string;
  subject_name: string;
  base_teacher_id: string | null;
  base_teacher_name: string | null;
  /** who takes the period in the final timetable; null for self-study or cancelled */
  teacher_id: string | null;
  teacher_name: string | null;
  state: "normal" | "covered" | "self_study" | "cancelled";
};

export type FinalDayPayload = {
  timetable_name: string | null;
  day_of_week: number;
  period_slots: FinalDayPeriod[];
  class_sections: { id: string; label: string; grade_label: string }[];
  absences: {
    teacher_id: string;
    teacher_name: string;
    is_full_day: boolean;
    from_period_number: number | null;
    to_period_number: number | null;
  }[];
  cells: FinalDayCell[];
};

export type FinalDay = {
  date: string;
  finalized: boolean;
  finalized_at: string | null;
  payload: FinalDayPayload | null;
};

export type FinalStatus = {
  date: string;
  finalized: boolean;
  version: number | null;
  finalized_at: string | null;
  finalized_by_name: string | null;
  up_to_date: boolean | null;
  needs_cover: number;
};

export const getFinalDay = (token: string | null, date: string) =>
  json<FinalDay>(apiFetch(`/day-timetable?date=${encodeURIComponent(date)}`, { token }));

export const getFinalStatus = (token: string | null, date: string) =>
  json<FinalStatus>(apiFetch(`/principal/day/final?date=${encodeURIComponent(date)}`, { token }));

export const finalizeDay = (token: string | null, date: string) =>
  json<FinalStatus>(
    apiFetch(`/principal/day/finalize?date=${encodeURIComponent(date)}`, { method: "POST", token }),
  );
