import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AdminPage from './page';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/components/ui/use-toast';
import type { User, TeacherGroup } from '@/server/db/types';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    getUsers: vi.fn(),
    getTeacherGroups: vi.fn(),
    updateUser: vi.fn(),
  },
}));

// Mock toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('AdminPage', () => {
  const mockUsers: User[] = [
    {
      id: 'teacher1',
      email: 'teacher@example.com',
      password_hash: null,
      oauth_provider: null,
      oauth_id: null,
      name: 'John Teacher',
      role: 'teacher',
      status: 'active',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
    {
      id: 'student1',
      email: 'student@example.com',
      password_hash: null,
      oauth_provider: null,
      oauth_id: null,
      name: 'Jane Student',
      role: 'student',
      status: 'active',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
  ];

  const mockTeacherGroups: TeacherGroup[] = [
    {
      id: 'group1',
      name: 'Math Teachers',
      created_at: new Date('2024-01-01'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads users and teacher groups on mount', async () => {
    const getUsersMock = vi.fn().mockResolvedValue({ users: mockUsers, total: 2 });
    const getGroupsMock = vi.fn().mockResolvedValue(mockTeacherGroups);
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);

    render(<AdminPage />);

    await waitFor(() => {
      expect(getUsersMock).toHaveBeenCalled();
      expect(getGroupsMock).toHaveBeenCalled();
    });
  });

  it('displays users in a table', async () => {
    const getUsersMock = vi.fn().mockResolvedValue({ users: mockUsers, total: 2 });
    const getGroupsMock = vi.fn().mockResolvedValue(mockTeacherGroups);
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('John Teacher')).toBeInTheDocument();
      expect(screen.getByText('teacher@example.com')).toBeInTheDocument();
    });
  });

  it('filters teachers by search query', async () => {
    const getUsersMock = vi.fn().mockResolvedValue({ users: mockUsers, total: 2 });
    const getGroupsMock = vi.fn().mockResolvedValue(mockTeacherGroups);
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('John Teacher')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(searchInput, { target: { value: 'john' } });

    await waitFor(() => {
      expect(screen.getByText('John Teacher')).toBeInTheDocument();
      expect(screen.queryByText('Jane Student')).not.toBeInTheDocument();
    });
  });

  it('filters students by search query', async () => {
    const getUsersMock = vi.fn().mockResolvedValue({ users: mockUsers, total: 2 });
    const getGroupsMock = vi.fn().mockResolvedValue(mockTeacherGroups);
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Jane Student')).toBeInTheDocument();
    });

    // Switch to students tab
    const studentsTab = screen.getByRole('tab', { name: /students/i });
    fireEvent.click(studentsTab);

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(searchInput, { target: { value: 'student' } });

    await waitFor(() => {
      expect(screen.getByText('Jane Student')).toBeInTheDocument();
      expect(screen.queryByText('John Teacher')).not.toBeInTheDocument();
    });
  });

  it('toggles user status from active to suspended', async () => {
    const getUsersMock = vi.fn().mockResolvedValue({ users: mockUsers, total: 2 });
    const getGroupsMock = vi.fn().mockResolvedValue(mockTeacherGroups);
    const updateUserMock = vi.fn().mockResolvedValue({
      ...mockUsers[0],
      status: 'suspended',
    });
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);
    vi.mocked(apiClient.updateUser).mockImplementation(updateUserMock);

    const toastMock = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: toastMock, dismiss: vi.fn(), toasts: [] });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('John Teacher')).toBeInTheDocument();
    });

    const suspendButton = screen.getAllByRole('button', { name: /suspend/i })[0]!;
    fireEvent.click(suspendButton);

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith('teacher1', { status: 'suspended' });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Status updated',
          description: 'User suspended',
        })
      );
    });
  });

  it('toggles user status from suspended to active', async () => {
    const suspendedUser = { ...mockUsers[0], status: 'suspended' as const };
    const getUsersMock = vi.fn().mockResolvedValue({ users: [suspendedUser, mockUsers[1]], total: 2 });
    const getGroupsMock = vi.fn().mockResolvedValue(mockTeacherGroups);
    const updateUserMock = vi.fn().mockResolvedValue({
      ...suspendedUser,
      status: 'active',
    });
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);
    vi.mocked(apiClient.updateUser).mockImplementation(updateUserMock);

    const toastMock = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: toastMock, dismiss: vi.fn(), toasts: [] });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('John Teacher')).toBeInTheDocument();
    });

    const activateButton = screen.getByRole('button', { name: /activate/i });
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith('teacher1', { status: 'active' });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Status updated',
          description: 'User activated',
        })
      );
    });
  });

  it('displays teacher groups', async () => {
    const getUsersMock = vi.fn().mockResolvedValue({ users: mockUsers, total: 2 });
    const getGroupsMock = vi.fn().mockResolvedValue(mockTeacherGroups);
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Math Teachers')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    const getUsersMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ users: mockUsers, total: 2 }), 100))
    );
    const getGroupsMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockTeacherGroups), 100))
    );
    vi.mocked(apiClient.getUsers).mockImplementation(getUsersMock);
    vi.mocked(apiClient.getTeacherGroups).mockImplementation(getGroupsMock);

    render(<AdminPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    return waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });
});
