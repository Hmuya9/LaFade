import type { Prisma } from "@prisma/client";

/**
 * Analytics filters to exclude test users and test data from analytics queries.
 * 
 * Use these filters in all analytics endpoints and admin dashboard queries
 * to ensure metrics only reflect real user behavior.
 */

/**
 * Filter for real (non-test) users.
 * Use this when querying User model directly.
 */
export const REAL_USER_WHERE: Prisma.UserWhereInput = {
  isTest: false,
};

/**
 * Filter for real (non-test) appointments.
 * Excludes appointments where either the client or barber is a test user.
 * Use this when querying Appointment model for analytics.
 */
export const REAL_APPOINTMENT_WHERE: Prisma.AppointmentWhereInput = {
  client: {
    isTest: false,
  },
  barber: {
    isTest: false,
  },
};

/**
 * Helper function to merge REAL_USER_WHERE with additional where conditions.
 * Safely combines filters without overwriting existing keys.
 * 
 * @example
 * const where = withRealUsers({ role: "CLIENT" });
 * // Result: { isTest: false, role: "CLIENT" }
 */
export function withRealUsers<T extends Prisma.UserWhereInput>(
  where: T
): T & Prisma.UserWhereInput {
  return {
    ...where,
    ...REAL_USER_WHERE,
  };
}

/**
 * Helper function to merge REAL_APPOINTMENT_WHERE with additional where conditions.
 * Safely combines filters without overwriting existing keys.
 * 
 * @example
 * const where = withRealAppointments({ status: "COMPLETED" });
 * // Result: { status: "COMPLETED", client: { isTest: false }, barber: { isTest: false } }
 */
export function withRealAppointments<T extends Prisma.AppointmentWhereInput>(
  where: T
): T & Prisma.AppointmentWhereInput {
  return {
    ...where,
    ...REAL_APPOINTMENT_WHERE,
  };
}

