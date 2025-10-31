import { render, screen } from '@/test/utils'
import { PricingCard } from './PricingCard'
import { PLANS } from '@/config/plans'

describe('PricingCard', () => {
  it('renders plan name and price', () => {
    const plan = PLANS[0]
    render(
      <PricingCard
        title={plan.name}
        price={`$${(plan.priceMonthlyCents/100).toFixed(2)}/mo`}
        bullets={plan.bullets}
      />
    )
    
    expect(screen.getByText(plan.name)).toBeInTheDocument()
    expect(screen.getByText(`$${(plan.priceMonthlyCents/100).toFixed(2)}/mo`)).toBeInTheDocument()
  })
})


