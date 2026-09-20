/**
 * The stage-02 archive node.
 *
 * In-world this is a separate machine: a legacy SHIELD archive host that was
 * never decommissioned, which agents scan as part of challenge 02. It is
 * served from this application rather than from a box of its own so that the
 * whole operation lives on one origin — one address to hand out, one set of
 * colours, and no second container to keep running.
 *
 * Access is still gated. `/archive` is listed in `PROTECTED` in `@/proxy` and
 * every page below re-checks with `requireUser()`, exactly like the briefing
 * pages, so the archive is not an unauthenticated hole in the platform just
 * because the fiction says it is an old server.
 *
 * What is *not* gated is the puzzle: once an agent is signed in the archive
 * answers honestly to anyone who asks correctly, which is the whole stage.
 */
export default function ArchiveLayout({ children }: LayoutProps<"/archive">) {
  return (
    <main className="relative min-h-dvh w-full bg-void">
      <div
        aria-hidden
        className="scanlines pointer-events-none fixed inset-0 z-10 opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-10 vignette"
      />

      <div className="relative z-20 mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </div>
    </main>
  );
}
