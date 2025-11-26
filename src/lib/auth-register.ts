import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface RegisterResult {
  success: true;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

export interface RegisterError {
  success: false;
  error: "EMAIL_EXISTS" | "INVALID_EMAIL" | "INVALID_PASSWORD" | "DATABASE_ERROR";
  message: string;
}

export type RegisterResponse = RegisterResult | RegisterError;

/**
 * Register a new user with email and password
 * 
 * @param params - Registration parameters
 * @param params.email - User email (will be normalized to lowercase)
 * @param params.password - Plain text password (will be hashed)
 * @param params.name - Optional user name
 * @returns RegisterResponse with success status and user data or error details
 */
export async function registerWithEmailPassword(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<RegisterResponse> {
  try {
    // 1. Normalize email (trim, lowercase)
    const normalizedEmail = params.email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return {
        success: false,
        error: "INVALID_EMAIL",
        message: "Invalid email address",
      };
    }

    // 2. Validate password
    if (!params.password || params.password.length < 6) {
      return {
        success: false,
        error: "INVALID_PASSWORD",
        message: "Password must be at least 6 characters",
      };
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return {
        success: false,
        error: "EMAIL_EXISTS",
        message: "A user with this email already exists",
      };
    }

    // 4. Hash the password with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(params.password, 10);

    // 5. Create new user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: params.name?.trim() || null,
        role: "CLIENT", // Default role, same as current behavior
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email!,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("[auth-register] Registration error:", error);
    return {
      success: false,
      error: "DATABASE_ERROR",
      message: "Failed to create user account",
    };
  }
}

