import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import BookingPage from './page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('BookingPage', () => {
  it('shows validation error on empty submit', async () => {
    const user = userEvent.setup()
    render(<BookingPage />)
    
    const submitButton = screen.getByText('Confirm Booking')
    await user.click(submitButton)
    
    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument()
  })
})
