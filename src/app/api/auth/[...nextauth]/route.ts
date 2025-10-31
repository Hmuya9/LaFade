import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth";

const { handlers } = NextAuth(authConfig);

// App Router requires you to export both verbs
export const GET = handlers.GET;
export const POST = handlers.POST;
