import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import LoginPage from './page';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    login: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('LoginPage', () => {
  let mockPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
  });

  it('renders login form with email and password fields', () => {
    render(<LoginPage />);

    expect(screen.getByText('School Portal')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits form with email and password credentials', async () => {
    const loginMock = vi.fn().mockResolvedValue({
      user: { id: 'user1', role: 'student', email: 'test@test.com', name: 'Test User', status: 'active' },
      token: 'token123',
    });
    vi.mocked(apiClient.login).mockImplementation(loginMock);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('test@test.com', 'password123');
    });
  });

  it('redirects to role-based dashboard on successful login', async () => {
    const loginMock = vi.fn().mockResolvedValue({
      user: { id: 'user1', role: 'admin', email: 'admin@test.com', name: 'Admin User', status: 'active' },
      token: 'token123',
    });
    vi.mocked(apiClient.login).mockImplementation(loginMock);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });
  });

  it('shows error toast on login failure with invalid credentials', async () => {
    const toastMock = vi.fn();
    const loginMock = vi.fn().mockRejectedValue(new Error('Unauthorized'));
    vi.mocked(apiClient.login).mockImplementation(loginMock);

    vi.mocked(useToast).mockReturnValue({ toast: toastMock, dismiss: vi.fn(), toasts: [] });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'wrong@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Login failed',
          description: 'Invalid credentials',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows error toast when email field is empty', async () => {
    const toastMock = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: toastMock, dismiss: vi.fn(), toasts: [] });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      })
    );
  });

  it('shows error toast when password field is empty', async () => {
    const toastMock = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: toastMock, dismiss: vi.fn(), toasts: [] });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      })
    );
  });

  it('disables submit button while loading', async () => {
    const loginMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        user: { id: 'user1', role: 'student', email: 'test@test.com', name: 'Test User', status: 'active' },
        token: 'token123',
      }), 100))
    );
    vi.mocked(apiClient.login).mockImplementation(loginMock);

    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });
});
