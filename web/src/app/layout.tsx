import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Onest, Unbounded } from "next/font/google";
import { IncomingCallDialog } from "@/components/friends/incoming-call-dialog";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin", "cyrillic"], weight: ["700"] });

export const metadata: Metadata = {
  title: "LinguaMatch — Practice languages with real people",
  description: "Meet a real person at your level, talk naturally, and let AI tell you exactly how to improve.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${onest.variable} ${unbounded.variable} font-sans`}>
        <ClerkProvider
          appearance={{ theme: shadcn }}
          signInUrl="/login"
          signUpUrl="/signup"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/onboarding"
          afterSignOutUrl="/"
        >
          <AuthProvider>
            {children}
            <IncomingCallDialog />
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
