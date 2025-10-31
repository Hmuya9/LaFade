import { render, screen } from '@/test/utils'
import { vi } from 'vitest'
import AdminDashboard from './page'

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      kpis: {
        activeMembers: 42,
        mrr: 50000,
        bookingsThisWeek: 15,
        completionRate: 0.95,
        churn30: 0.02,
        trials7: 8,
        revenue30: 50000,
        profit: 15000,
        breakdown: {
          baseCost: 10000,
          standardCost: 15000,
          deluxeCost: 8000,
          bonusCost: 2000,
          opsCost: 0,
        },
      },
    }),
  })
) as any

describe('AdminDashboard', () => {
  it('renders KPI cards with mock data', async () => {
    render(<AdminDashboard />)
    
    expect(await screen.findByText('Active Members')).toBeInTheDocument()
    expect(await screen.findByText('42')).toBeInTheDocument()
  })
})
