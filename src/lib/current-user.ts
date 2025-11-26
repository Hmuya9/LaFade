import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";

type ResolveReason = "byId" | "byEmail";

export class ResolveCurrentUserError extends Error {
  constructor(
    public readonly reason: "NO_SESSION" | "USER_NOT_FOUND"
  ) {
    super(reason);
    this.name = "ResolveCurrentUserError";
  }
}

interface ResolvedUser {
  id: string;
  email: string;
  role: Role;
  passwordHash: string | null;
}

interface ResolveResult {
  session: Session;
  user: ResolvedUser;
  method: ResolveReason;
}

export async function resolveCurrentUser(): Promise<ResolveResult> {
  const session = await auth();

  if (!session?.user) {
    throw new ResolveCurrentUserError("NO_SESSION");
  }

  const sessionUser = session.user as any;
  const sessionUserId = sessionUser?.id as string | undefined;
  const sessionEmail = session.user.email as string | undefined;

  let method: ResolveReason | null = null;
  let user: ResolvedUser | null = null;

  if (sessionUserId) {
    user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });
    method = "byId";
  }

  if (!user && sessionEmail) {
    user = await prisma.user.findUnique({
      where: { email: sessionEmail },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });
    method = "byEmail";
  }

  if (!user || !method) {
    throw new ResolveCurrentUserError("USER_NOT_FOUND");
  }

  console.log("[user-resolve]", {
    method,
    resolvedUserId: user.id,
    resolvedEmail: user.email,
    sessionUserId,
    sessionEmail,
  });

  return { session, user, method };
}



