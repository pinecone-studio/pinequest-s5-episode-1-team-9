"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { Logo } from "@/components/site/header";

/** Clerk's hosted sign-in / sign-up UI. After it, pages route to /onboarding or /match themselves. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      {mode === "signup" ? (
        <SignUp routing="path" path="/signup" signInUrl="/login" />
      ) : (
        <SignIn routing="path" path="/login" signUpUrl="/signup" />
      )}
    </div>
  );
}
