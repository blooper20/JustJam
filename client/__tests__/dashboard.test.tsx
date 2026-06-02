/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import TeamSelectionPage from '../app/[locale]/dashboard/page';

// Mock team-provider
const mockUseTeam = jest.fn();
jest.mock('@/components/team-provider', () => ({
  useTeam: () => mockUseTeam(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 1 } } }),
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt="" />,
}));

describe('TeamSelectionPage', () => {
  it('renders loading state', () => {
    mockUseTeam.mockReturnValue({
      teams: [],
      setSelectedTeamId: jest.fn(),
      isLoading: true,
    });

    render(<TeamSelectionPage />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders team list correctly', () => {
    mockUseTeam.mockReturnValue({
      teams: [
        { id: 1, name: 'Delispice', owner_id: 1, members: [{}, {}] },
        { id: 2, name: 'Maroon 5', owner_id: 2, members: [{}] },
      ],
      setSelectedTeamId: jest.fn(),
      isLoading: false,
    });

    render(<TeamSelectionPage />);

    expect(screen.getByText('Delispice')).toBeInTheDocument();
    expect(screen.getByText('Maroon 5')).toBeInTheDocument();
    expect(screen.getByText('멤버 2명')).toBeInTheDocument();
    expect(screen.getByText('멤버 1명')).toBeInTheDocument();
  });

  it('shows empty state when no teams exist', () => {
    mockUseTeam.mockReturnValue({
      teams: [],
      setSelectedTeamId: jest.fn(),
      isLoading: false,
    });

    render(<TeamSelectionPage />);

    expect(screen.getByText('첫 번째 밴드를 만들어보세요')).toBeInTheDocument();
    expect(screen.getByText('새 밴드 만들기')).toBeInTheDocument();
  });
});
