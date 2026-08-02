"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/intake", label: "New Mission" },
  { href: "/missions", label: "Missions" },
  { href: "/governance", label: "Governance" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        setEmail(d.email);
        setPersistence(d.persistence_mode);
      })
      .catch(() => undefined);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (pathname === "/login") return null;

  return (
    <header className="border-b border-[var(--border)] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-wrap items-baseline gap-2 md:gap-3">
          <Link href="/intake" className="text-xl font-[family-name:var(--font-display)] font-bold">
            AIPOS
          </Link>
          <span className="text-sm font-semibold text-[var(--accent)]">Mission Commander</span>
          <span className="text-sm text-[var(--ink-muted)] hide-mobile">Intake MVP</span>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--ink-muted)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          {persistence === "dev-file" && (
            <span className="badge badge-pending" title="Development persistence only">
              DEV file store
            </span>
          )}
          {email ? (
            <>
              <span className="hide-mobile">{email}</span>
              <button type="button" className="btn btn-secondary !py-1.5 !text-sm" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-secondary !py-1.5 !text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
