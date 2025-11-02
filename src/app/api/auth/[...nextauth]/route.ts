import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// App Router requires you to export both verbs
export const GET = handler;
export const POST = handler;
