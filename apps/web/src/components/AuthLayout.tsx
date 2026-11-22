import type { ReactNode } from "react";
import { BrandPanel } from "./BrandPanel";
import { Logo } from "./Logo";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-9 lg:hidden">
            <Logo to="/login" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
