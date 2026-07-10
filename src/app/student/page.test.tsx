import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StudentPage from './page';
import * as apiModule from '@/lib/api/client';
import type { Class, Assignment } from '@/server/db/types';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    getClasses: vi.fn(),
    getAssignments: vi.fn(),
  },
}));

// Mock toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('StudentPage', () => {
  const mockClasses: Class[] = [
    {
      id: 'class1',
      teacher_id: 'teacher1',
      name: 'Mathematics 101',
      created_at: new Date('2024-01-01'),
    },
    {
      id: 'class2',
      teacher_id: 'teacher2',
      name: 'Physics 101',
      created_at: new Date('2024-01-01'),
    },
  ];

  const mockAssignments: Record<string, Assignment[]> = {
    class1: [
      {
        id: 'assignment1',
        class_id: 'class1',
        title: 'Algebra Problems',
        description: 'Solve 10 algebra problems',
        due_at: new Date('2024-02-15'),
        published_at: new Date('2024-01-10'),
        created_at: new Date('2024-01-10'),
        max_points: 100,
      },
      {
        id: 'assignment2',
        class_id: 'class1',
        title: 'Calculus Exercises',
        description: null,
        due_at: new Date('2024-03-01'),
        published_at: null,
        created_at: new Date('2024-01-15'),
        max_points: 50,
      },
    ],
    class2: [
      {
        id: 'assignment3',
        class_id: 'class2',
        title: 'Force and Motion Lab',
        description: 'Conduct physics lab experiment',
        due_at: new Date('2024-02-28'),
        published_at: new Date('2024-01-12'),
        created_at: new Date('2024-01-12'),
        max_points: 75,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads classes on mount', async () => {
    const getClassesMock = vi.fn().mockResolvedValue(mockClasses);
    const getAssignmentsMock = vi.fn().mockResolvedValue([]);
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(getClassesMock).toHaveBeenCalled();
    });
  });

  it('displays enrolled classes', async () => {
    const getClassesMock = vi.fn().mockResolvedValue(mockClasses);
    const getAssignmentsMock = vi.fn().mockImplementation((classId) =>
      Promise.resolve(mockAssignments[classId] || [])
    );
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('Mathematics 101')).toBeInTheDocument();
      expect(screen.getByText('Physics 101')).toBeInTheDocument();
    });
  });

  it('displays assignments for each class', async () => {
    const getClassesMock = vi.fn().mockResolvedValue(mockClasses);
    const getAssignmentsMock = vi.fn().mockImplementation((classId) =>
      Promise.resolve(mockAssignments[classId] || [])
    );
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('Algebra Problems')).toBeInTheDocument();
      expect(screen.getByText('Calculus Exercises')).toBeInTheDocument();
      expect(screen.getByText('Force and Motion Lab')).toBeInTheDocument();
    });
  });

  it('shows assignment count in class headers', async () => {
    const getClassesMock = vi.fn().mockResolvedValue(mockClasses);
    const getAssignmentsMock = vi.fn().mockImplementation((classId) =>
      Promise.resolve(mockAssignments[classId] || [])
    );
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('2 assignments')).toBeInTheDocument();
      expect(screen.getByText('1 assignment')).toBeInTheDocument();
    });
  });

  it('displays "No assignments yet" for classes with no assignments', async () => {
    const classWithoutAssignments = [
      {
        id: 'class3',
        teacher_id: 'teacher3',
        name: 'History 101',
        created_at: new Date('2024-01-01'),
      },
    ];
    const getClassesMock = vi.fn().mockResolvedValue(classWithoutAssignments);
    const getAssignmentsMock = vi.fn().mockResolvedValue([]);
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('No assignments yet')).toBeInTheDocument();
    });
  });

  it('shows due date for assignments', async () => {
    const getClassesMock = vi.fn().mockResolvedValue(mockClasses);
    const getAssignmentsMock = vi.fn().mockImplementation((classId) =>
      Promise.resolve(mockAssignments[classId] || [])
    );
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText(/due: 2\/15\/2024/i)).toBeInTheDocument();
      expect(screen.getByText(/due: 3\/1\/2024/i)).toBeInTheDocument();
    });
  });

  it('distinguishes between published and draft assignments', async () => {
    const getClassesMock = vi.fn().mockResolvedValue(mockClasses);
    const getAssignmentsMock = vi.fn().mockImplementation((classId) =>
      Promise.resolve(mockAssignments[classId] || [])
    );
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      const badges = screen.getAllByText(/published|draft/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('shows loading state initially', () => {
    const getClassesMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockClasses), 100))
    );
    const getAssignmentsMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    );
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    expect(screen.getByText(/loading your classes/i)).toBeInTheDocument();

    return waitFor(() => {
      expect(screen.queryByText(/loading your classes/i)).not.toBeInTheDocument();
    });
  });

  it('shows "No classes enrolled" when student has no classes', async () => {
    const getClassesMock = vi.fn().mockResolvedValue([]);
    const getAssignmentsMock = vi.fn().mockResolvedValue([]);
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText(/no classes enrolled/i)).toBeInTheDocument();
    });
  });

  it('loads assignments for all enrolled classes', async () => {
    const getClassesMock = vi.fn().mockResolvedValue(mockClasses);
    const getAssignmentsMock = vi.fn().mockImplementation((classId) =>
      Promise.resolve(mockAssignments[classId] || [])
    );
    (apiModule.apiClient.getClasses as any) = getClassesMock;
    (apiModule.apiClient.getAssignments as any) = getAssignmentsMock;

    render(<StudentPage />);

    await waitFor(() => {
      expect(getAssignmentsMock).toHaveBeenCalledWith('class1');
      expect(getAssignmentsMock).toHaveBeenCalledWith('class2');
    });
  });
});
