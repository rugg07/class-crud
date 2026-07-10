import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'suspended';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string | null;
  oauth_provider: string | null;
  oauth_id: string | null;
  name: string;
  role: UserRole;
  status: Generated<UserStatus>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface TeacherGroupsTable {
  id: Generated<string>;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface TeacherGroupMembersTable {
  teacher_group_id: string;
  teacher_id: string;
}

export interface ClassesTable {
  id: Generated<string>;
  teacher_id: string;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface EnrollmentsTable {
  class_id: string;
  student_id: string;
  enrolled_at: ColumnType<Date, string | undefined, never>;
}

export interface AssignmentsTable {
  id: Generated<string>;
  class_id: string;
  title: string;
  description: string | null;
  due_at: ColumnType<Date, string | undefined, string | undefined> | null;
  published_at: ColumnType<Date, string | undefined, string | undefined> | null;
  created_at: ColumnType<Date, string | undefined, never>;
  max_points: number;
}

export interface SubmissionsTable {
  id: Generated<string>;
  assignment_id: string;
  student_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface SubmissionVersionsTable {
  id: Generated<string>;
  submission_id: string;
  version_number: number;
  content: string;
  submitted_at: ColumnType<Date, string | undefined, never>;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
}

export interface GradesTable {
  id: Generated<string>;
  submission_id: string;
  graded_version_id: string;
  grade: number;
  feedback: string | null;
  graded_by: string;
  graded_at: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  users: UsersTable;
  teacher_groups: TeacherGroupsTable;
  teacher_group_members: TeacherGroupMembersTable;
  classes: ClassesTable;
  enrollments: EnrollmentsTable;
  assignments: AssignmentsTable;
  submissions: SubmissionsTable;
  submission_versions: SubmissionVersionsTable;
  grades: GradesTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type TeacherGroup = Selectable<TeacherGroupsTable>;
export type NewTeacherGroup = Insertable<TeacherGroupsTable>;

export type Class = Selectable<ClassesTable>;
export type NewClass = Insertable<ClassesTable>;

export type Enrollment = Selectable<EnrollmentsTable>;

export type Assignment = Selectable<AssignmentsTable>;
export type NewAssignment = Insertable<AssignmentsTable>;

export type Submission = Selectable<SubmissionsTable>;
export type SubmissionVersion = Selectable<SubmissionVersionsTable>;
export type Grade = Selectable<GradesTable>;
