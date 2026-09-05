import type { Role, Teacher } from "./api";

export type StoredUser = {
  id: string;
  email: string;
  password?: string;
  full_name: string;
  role: Role;
  school_id: string;
  school_name: string;
  school_udise_code: string;
  mobile_number?: string;
  employee_code?: string;
  qualification?: string;
  experience?: string | number;
  teaching_subject?: string;
  teaching_classes?: string;
  joining_date?: string;
  grade_id?: string;
  grade_label?: string;
  roll_number?: string;
};

const DEFAULT_USERS: StoredUser[] = [
  {
    id: "fbc74b75-3826-49f7-8ae3-5da6771daf80",
    email: "principal@bihar.gov.in",
    password: "password123",
    full_name: "Dr. Rajeshwar Singh",
    role: "principal",
    school_id: "8097e737-26d0-46a8-a3e2-ca93ec8aed6e",
    school_name: "Govt. Girls High School Patna City",
    school_udise_code: "10280105528",
    joining_date: "2023-06-15",
    experience: 16,
  },
  {
    id: "0f9e8ac3-2b84-4516-8596-f15a747ffd98",
    email: "teacher@bihar.gov.in",
    password: "password123",
    full_name: "Nidhi Priya",
    role: "teacher",
    school_id: "sch-10280105528",
    school_name: "Govt. Girls High School Patna City",
    school_udise_code: "10280105528",
    employee_code: "TCH-BHR-4892",
    qualification: "B.Ed, M.Sc (Science)",
    experience: 8,
    teaching_subject: "Science",
    teaching_classes: "Class 9 & 10",
  },
  {
    id: "8a9b243a-0afa-492e-8848-f021cd7e7a9f",
    email: "student@bihar.gov.in",
    password: "password123",
    full_name: "Priya Sharma",
    role: "student",
    school_id: "sch-10280105528",
    school_name: "Govt. Girls High School Patna City",
    school_udise_code: "10280105528",
    grade_id: "07c4ae8c-2028-49b2-96c4-44f3e63b2c52",
    grade_label: "Class 9",
    roll_number: "24",
  },
];

export function getUserDirectory(): Record<string, StoredUser> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("medha_user_directory");
    const dir: Record<string, StoredUser> = raw ? JSON.parse(raw) : {};
    // Seed defaults if missing
    for (const u of DEFAULT_USERS) {
      if (!dir[u.email.toLowerCase()]) {
        dir[u.email.toLowerCase()] = u;
      }
    }
    return dir;
  } catch {
    return {};
  }
}

export function saveUserToDirectory(user: StoredUser) {
  if (typeof window === "undefined") return;
  try {
    const dir = getUserDirectory();
    dir[user.email.toLowerCase()] = user;
    localStorage.setItem("medha_user_directory", JSON.stringify(dir));
  } catch {}
}

export function findUserByCredential(
  identifier: string,
): StoredUser | null {
  const dir = getUserDirectory();
  const clean = identifier.trim().toLowerCase();

  // Match by email
  if (dir[clean]) return dir[clean];

  // Match by roll number or student ID
  for (const u of Object.values(dir)) {
    if (u.roll_number && u.roll_number.toLowerCase() === clean) return u;
    if (u.employee_code && u.employee_code.toLowerCase() === clean) return u;
  }

  return null;
}
