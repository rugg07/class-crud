import type {
  User,
  TeacherGroup,
  Class,
  Assignment,
  Submission,
  Grade,
} from '@/server/db/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface LoginResponse {
  user: User;
  token: string;
}

interface GoogleAuthorizeResponse {
  url: string;
}

interface ListUsersResponse {
  users: User[];
  total: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me', {
      method: 'GET',
    });
  }

  async googleAuthorize(): Promise<string> {
    const response = await this.request<GoogleAuthorizeResponse>(
      '/auth/google/authorize',
      {
        method: 'GET',
      }
    );
    return response.url;
  }

  // Users (admin only)
  async getUsers(limit = 20, offset = 0): Promise<ListUsersResponse> {
    return this.request<ListUsersResponse>(
      `/users?limit=${limit}&offset=${offset}`,
      { method: 'GET' }
    );
  }

  async getUser(id: string): Promise<User> {
    return this.request<User>(`/users/${id}`, { method: 'GET' });
  }

  async createUser(
    email: string,
    name: string,
    role: 'admin' | 'teacher' | 'student',
    password?: string
  ): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify({ email, name, role, password }),
    });
  }

  async updateUser(
    id: string,
    updates: { name?: string; role?: string; status?: string }
  ): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Teacher Groups (admin only)
  async getTeacherGroups(): Promise<TeacherGroup[]> {
    return this.request<TeacherGroup[]>('/teacher-groups', {
      method: 'GET',
    });
  }

  async createTeacherGroup(name: string): Promise<TeacherGroup> {
    return this.request<TeacherGroup>('/teacher-groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateTeacherGroup(id: string, name: string): Promise<TeacherGroup> {
    return this.request<TeacherGroup>(`/teacher-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async deleteTeacherGroup(id: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/teacher-groups/${id}`, {
      method: 'DELETE',
    });
  }

  // Classes (teacher/student)
  async getClasses(): Promise<Class[]> {
    return this.request<Class[]>('/classes', { method: 'GET' });
  }

  async getClass(id: string): Promise<Class> {
    return this.request<Class>(`/classes/${id}`, { method: 'GET' });
  }

  async createClass(name: string): Promise<Class> {
    return this.request<Class>('/classes', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateClass(id: string, name: string): Promise<Class> {
    return this.request<Class>(`/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async deleteClass(id: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/classes/${id}`, {
      method: 'DELETE',
    });
  }

  async getClassStudents(classId: string): Promise<User[]> {
    return this.request<User[]>(`/classes/${classId}/students`, {
      method: 'GET',
    });
  }

  async enrollStudent(classId: string, studentId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/classes/${classId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    });
  }

  async removeStudent(classId: string, studentId: string): Promise<void> {
    await this.request<{ ok: boolean }>(
      `/classes/${classId}/students/${studentId}`,
      { method: 'DELETE' }
    );
  }

  // Assignments (teacher/student)
  async getAssignments(classId: string): Promise<Assignment[]> {
    return this.request<Assignment[]>(
      `/classes/${classId}/assignments`,
      { method: 'GET' }
    );
  }

  async createAssignment(
    classId: string,
    title: string,
    description?: string,
    dueAt?: Date
  ): Promise<Assignment> {
    return this.request<Assignment>(
      `/classes/${classId}/assignments`,
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          due_at: dueAt?.toISOString(),
        }),
      }
    );
  }

  async updateAssignment(
    classId: string,
    assignmentId: string,
    updates: { title?: string; description?: string; due_at?: string }
  ): Promise<Assignment> {
    return this.request<Assignment>(
      `/classes/${classId}/assignments/${assignmentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
  }

  async publishAssignment(
    classId: string,
    assignmentId: string
  ): Promise<Assignment> {
    return this.request<Assignment>(
      `/classes/${classId}/assignments/${assignmentId}/publish`,
      { method: 'POST' }
    );
  }

  async deleteAssignment(
    classId: string,
    assignmentId: string
  ): Promise<void> {
    await this.request<{ ok: boolean }>(
      `/classes/${classId}/assignments/${assignmentId}`,
      { method: 'DELETE' }
    );
  }

  // Submissions (student/teacher)
  async submitAssignment(assignmentId: string, content: string): Promise<Submission> {
    return this.request<Submission>(
      `/assignments/${assignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );
  }

  async getSubmissions(assignmentId: string): Promise<Submission[]> {
    return this.request<Submission[]>(
      `/assignments/${assignmentId}/submissions`,
      { method: 'GET' }
    );
  }

  async getSubmission(submissionId: string): Promise<Submission> {
    return this.request<Submission>(
      `/submissions/${submissionId}`,
      { method: 'GET' }
    );
  }

  // Grades (teacher/student)
  async gradeSubmission(
    submissionId: string,
    grade: number,
    feedback?: string
  ): Promise<Grade> {
    return this.request<Grade>(
      `/submissions/${submissionId}/grade`,
      {
        method: 'POST',
        body: JSON.stringify({ grade, feedback }),
      }
    );
  }

  async getGrade(submissionId: string): Promise<Grade | null> {
    return this.request<Grade | null>(
      `/submissions/${submissionId}/grade`,
      { method: 'GET' }
    );
  }

  async getGrades(submissionId: string): Promise<Grade[]> {
    return this.request<Grade[]>(
      `/submissions/${submissionId}/grades`,
      { method: 'GET' }
    );
  }

  async getAssignmentGrades(assignmentId: string): Promise<Grade[]> {
    return this.request<Grade[]>(
      `/assignments/${assignmentId}/grades`,
      { method: 'GET' }
    );
  }
}

export const apiClient = new ApiClient();
