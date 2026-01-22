import { render, screen, fireEvent } from '@testing-library/react'
import DashboardPage from '../app/dashboard/page'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchProjects } from '@/lib/api'

// Mock react-query
jest.mock('@tanstack/react-query', () => ({
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(),
}))

// Mock sonner
jest.mock('sonner', () => ({
    toast: jest.fn(),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

// Mock next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} />,
}))

describe('DashboardPage', () => {
    const mockProjects = [
        {
            id: '1',
            name: 'Test Song 1',
            status: 'completed',
            created_at: '2024-01-20T10:00:00Z',
            has_score: true,
            has_tab: false,
        },
        {
            id: '2',
            name: 'Test Song 2',
            status: 'processing',
            created_at: '2024-01-21T10:00:00Z',
            has_score: false,
            has_tab: false,
        },
    ]

    beforeEach(() => {
        ; (useQueryClient as jest.Mock).mockReturnValue({
            invalidateQueries: jest.fn(),
        })

            ; (useMutation as jest.Mock).mockReturnValue({
                mutate: jest.fn(),
                isPending: false,
            })
    })

    it('renders loading state', () => {
        ; (useQuery as jest.Mock).mockReturnValue({
            data: null,
            isLoading: true,
        })

        render(<DashboardPage />)
        expect(screen.getByText(/프로젝트 불러오는 중/i)).toBeInTheDocument()
    })

    it('renders project list correctly', () => {
        ; (useQuery as jest.Mock).mockReturnValue({
            data: mockProjects,
            isLoading: false,
        })

        render(<DashboardPage />)

        expect(screen.getByText('Test Song 1')).toBeInTheDocument()
        expect(screen.getByText('Test Song 2')).toBeInTheDocument()
        expect(screen.getByText('완료됨')).toBeInTheDocument()
        expect(screen.getByText('분리 중...')).toBeInTheDocument()
    })

    it('shows stats correctly', () => {
        ; (useQuery as jest.Mock).mockReturnValue({
            data: mockProjects,
            isLoading: false,
        })

        render(<DashboardPage />)

        // Completed projects: 1 (Song 1 is completed. Song 2 is processing).
        // Song 1 has score. 
        // Song 1 has no tab.

        // Check "보유 중" for Songs (completedProjects)
        const completedLabels = screen.getAllByText('보유 중')
        expect(completedLabels.length).toBe(3) // One for each category
    })
})
