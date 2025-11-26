"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { changePasswordSchema, setPasswordSchema } from "@/lib/schemas/password";

export type PasswordActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function changePassword(
  formData: FormData
): Promise<PasswordActionResult> {
  const actionName = "changePassword";
  
  try {
    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] Starting password change...`);
    }

    const session = await auth();

    if (!session?.user) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[${actionName}] No session or user:`, { hasSession: !!session });
      }
      return {
        success: false,
        message: "Not authenticated. Please sign in.",
      };
    }

    // Get user ID from session (stored as (user as any).id in session callback)
    const userId = (session.user as any)?.id;
    const userEmail = session.user.email;
    
    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] Session data:`, {
        userId: userId || "MISSING",
        userEmail: userEmail || "MISSING",
        hasUserId: !!userId,
        hasEmail: !!userEmail,
      });
    }

    if (!userId && !userEmail) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[${actionName}] No user ID or email in session`);
      }
      return {
        success: false,
        message: "Not authenticated. Please sign in.",
      };
    }

    // Load user from DB - try by ID first, then by email
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true, email: true },
      });
      
      if (process.env.NODE_ENV === "development") {
        console.log(`[${actionName}] Lookup by ID:`, {
          userId,
          found: !!user,
          hasPasswordHash: !!user?.passwordHash,
        });
      }
    }
    
    // If not found by ID and we have an email, try by email
    if (!user && userEmail) {
      user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, passwordHash: true, email: true },
      });
      
      if (process.env.NODE_ENV === "development") {
        console.log(`[${actionName}] Lookup by email:`, {
          email: userEmail,
          found: !!user,
          hasPasswordHash: !!user?.passwordHash,
        });
      }
    }

    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.error("[changePassword] User not found in DB:", {
          userId,
          email: session.user.email,
        });
      }
      return {
        success: false,
        message: "User not found. Please try signing in again.",
      };
    }

    // Check if user has a password
    if (!user.passwordHash) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[${actionName}] User has no passwordHash:`, {
          userId: user.id,
          email: user.email,
        });
      }
      return {
        success: false,
        message: "You don't have a password yet. Use 'Set password' instead.",
      };
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] User has passwordHash (length: ${user.passwordHash.length})`);
    }

    // Parse and validate input
    const rawData = {
      currentPassword: String(formData.get("currentPassword") || ""),
      newPassword: String(formData.get("newPassword") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
    };

    const validation = changePasswordSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(err.message);
      });

      return {
        success: false,
        message: "Validation failed. Please check your input.",
        fieldErrors,
      };
    }

    const { currentPassword, newPassword } = validation.data;

    // Verify current password
    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] Verifying current password...`, {
        userId: user.id,
        email: user.email,
        currentPasswordLength: currentPassword.length,
        passwordHashPrefix: user.passwordHash.substring(0, 10),
      });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValid) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[${actionName}] Password verification FAILED`);
      }
      return {
        success: false,
        message: "Current password is incorrect.",
      };
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] Password verified successfully, hashing new password...`);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] New password hashed, updating DB...`);
    }

    // Update passwordHash
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] ✅ Password updated successfully in DB`);
    }

    return {
      success: true,
      message: "Password updated successfully! ✨",
    };
  } catch (error) {
    console.error("[changePassword] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (process.env.NODE_ENV === "development") {
      console.error("[changePassword] Full error details:", {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    
    return {
      success: false,
      message: errorMessage.includes("Unique constraint") 
        ? "An error occurred. Please try again."
        : "Failed to update password. Please try again.",
    };
  }
}

export async function setPassword(
  formData: FormData
): Promise<PasswordActionResult> {
  const actionName = "setPassword";
  
  try {
    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] Starting password set...`);
    }

    const session = await auth();

    if (!session?.user) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[${actionName}] No session or user:`, { hasSession: !!session });
      }
      return {
        success: false,
        message: "Not authenticated. Please sign in.",
      };
    }

    // Get user ID from session (stored as (user as any).id in session callback)
    const userId = (session.user as any)?.id;
    const userEmail = session.user.email;
    
    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] Session data:`, {
        userId: userId || "MISSING",
        userEmail: userEmail || "MISSING",
        hasUserId: !!userId,
        hasEmail: !!userEmail,
      });
    }

    if (!userId && !userEmail) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[${actionName}] No user ID or email in session`);
      }
      return {
        success: false,
        message: "Not authenticated. Please sign in.",
      };
    }

    // Load user from DB - try by ID first, then by email
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true, email: true },
      });
      
      if (process.env.NODE_ENV === "development") {
        console.log(`[${actionName}] Lookup by ID:`, {
          userId,
          found: !!user,
          hasPasswordHash: !!user?.passwordHash,
        });
      }
    }
    
    // If not found by ID and we have an email, try by email
    if (!user && userEmail) {
      user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, passwordHash: true, email: true },
      });
      
      if (process.env.NODE_ENV === "development") {
        console.log(`[${actionName}] Lookup by email:`, {
          email: userEmail,
          found: !!user,
          hasPasswordHash: !!user?.passwordHash,
        });
      }
    }

    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.error("[setPassword] User not found in DB:", {
          userId,
          email: session.user.email,
        });
      }
      return {
        success: false,
        message: "User not found. Please try signing in again.",
      };
    }

    // Check if user already has a password
    if (user.passwordHash) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[${actionName}] User already has passwordHash:`, {
          userId: user.id,
          email: user.email,
          passwordHashLength: user.passwordHash.length,
        });
      }
      return {
        success: false,
        message: "You already have a password. Use 'Change password' instead.",
      };
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] User has no passwordHash - proceeding to set password`);
    }

    // Parse and validate input
    const rawData = {
      newPassword: String(formData.get("newPassword") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
    };

    const validation = setPasswordSchema.safeParse(rawData);

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(err.message);
      });

      return {
        success: false,
        message: "Validation failed. Please check your input.",
        fieldErrors,
      };
    }

    const { newPassword } = validation.data;

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] Hashing new password...`, {
        userId: user.id,
        email: user.email,
        newPasswordLength: newPassword.length,
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] New password hashed, updating DB...`);
    }

    // Update passwordHash
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[${actionName}] ✅ Password set successfully in DB`);
    }

    return {
      success: true,
      message: "Password set successfully! ✨",
    };
  } catch (error) {
    console.error("[setPassword] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (process.env.NODE_ENV === "development") {
      console.error("[setPassword] Full error details:", {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    
    return {
      success: false,
      message: errorMessage.includes("Unique constraint") 
        ? "An error occurred. Please try again."
        : "Failed to set password. Please try again.",
    };
  }
}

