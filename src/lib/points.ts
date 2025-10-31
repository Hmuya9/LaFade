import { prisma } from "@/lib/db"

export async function getPointsBalance(userId: string): Promise<number> {
  const result = await prisma.pointsLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  })
  
  return result._sum.delta || 0
}

export async function credit(
  userId: string, 
  delta: number, 
  reason: string, 
  refType?: string, 
  refId?: string
): Promise<void> {
  await prisma.pointsLedger.create({
    data: {
      userId,
      delta,
      reason,
      refType,
      refId,
    },
  })
}

export async function debit(
  userId: string, 
  delta: number, 
  reason: string, 
  refType?: string, 
  refId?: string
): Promise<void> {
  const balance = await getPointsBalance(userId)
  
  if (balance < delta) {
    throw new Error(`Insufficient points. Required: ${delta}, Available: ${balance}`)
  }
  
  await prisma.pointsLedger.create({
    data: {
      userId,
      delta: -delta, // Store as negative
      reason,
      refType,
      refId,
    },
  })
}
