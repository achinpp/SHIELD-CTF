import type { Metadata } from "next";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Briefing",
};

/**
 * The first page behind the gate.
 *
 * `requireUser()` is the real access check — it resolves the session against
 * the database on every request. The proxy redirect is only a shortcut for
 * visitors with no cookie at all.
 */
export default async function Briefing() {
  const agent = await requireUser();

  return (
    <main className="relative grid h-dvh w-screen place-items-center overflow-hidden bg-void px-6">
      <div
        aria-hidden
        className="scanlines pointer-events-none absolute inset-0 opacity-25"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 vignette" />

      <div className="relative max-w-lg text-center font-mono">
        <p className="text-[11px] tracking-[0.3em] text-alert">
          CLEARANCE LEVEL 7 &mdash; VERIFIED
        </p>
        <h1 className="mt-6 text-2xl font-semibold tracking-[0.2em] text-signal sm:text-3xl">
          MISSION BRIEFING
        </h1>

        <p className="mt-5 text-sm leading-relaxed tracking-wide text-signal/60">
          Welcome back, agent{" "}
          <span className="text-signal">{agent.codename}</span>. Challenge board
          is still being provisioned &mdash; check back once the operation goes
          live.
        </p>

        <form action={logout} className="mt-10">
          <button
            type="submit"
            className="inline-flex items-center gap-3 border border-signal/40 px-6 py-2.5 text-[11px] tracking-[0.3em] text-signal transition-colors hover:border-signal hover:bg-signal/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
          >
            <span>&lsaquo;</span> END SESSION
          </button>
        </form>
      </div>
    </main>
  );
}
