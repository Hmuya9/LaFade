// Types for the Le Fade application

export interface User {
  id: string
  role: 'CLIENT' | 'BARBER' | 'OWNER'
  email?: string
  phone?: string
  name?: string
  clerkId?: string
  createdAt: Date
}

export interface Plan {
  id: string
  name: string
  priceMonthly: number
  cutsPerMonth: number
  isHome: boolean
  stripePriceId: string
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  startDate: Date
  renewsAt: Date
  stripeSubId: string
  user?: User
  plan?: Plan
}

export interface Appointment {
  id: string
  clientId: string
  barberId: string
  type: 'SHOP' | 'HOME'
  startAt: Date
  endAt: Date
  status: 'BOOKED' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELED'
  address?: string
  notes?: string
  isFree: boolean
  client?: User
  barber?: User
}

export interface AdminMetrics {
  activeMembers: number
  mrr: number
  bookingsThisWeek: number
  completionRate: number
  churn30: number
  trials7: number
  revenue30: number
  costs: number
  profit: number
  breakdown: {
    baseCost: number
    standardCost: number
    deluxeCost: number
    bonusCost: number
    opsCost: number
  }
}

