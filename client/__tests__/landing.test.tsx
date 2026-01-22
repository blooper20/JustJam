import { render, screen } from '@testing-library/react';
import LandingPage from '../app/page';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('LandingPage', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('renders landing page correctly for unauthenticated user', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(<LandingPage />);

    expect(screen.getByText(/PRACTICE/i)).toBeInTheDocument();
    expect(screen.getByText(/LIKE A PRO/i)).toBeInTheDocument();
    expect(screen.getByText(/지금 시작하기/i)).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'loading',
    });

    const { container } = render(<LandingPage />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('redirects to dashboard if already authenticated', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { name: 'Test User' } },
      status: 'authenticated',
    });

    render(<LandingPage />);

    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });
});
