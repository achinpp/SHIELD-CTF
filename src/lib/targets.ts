import "server-only";

/**
 * Live challenge targets.
 *
 * The third shape a stage's evidence can take, alongside the stage-03 query
 * terminal and the stage-06/07 download. Stage 02 is neither: there is no file
 * to withhold or hand over, because the artifact is a running service the
 * agent has to go and interrogate.
 *
 * The service is this application. Stage 02's archive used to be a separate
 * Flask container on its own port, which meant a second image to build, a
 * second thing to keep running, and a target that looked nothing like the rest
 * of the operation. It is now `/archive` on this origin — same palette, same
 * type, same session — so there is one address to hand out and nothing extra
 * to deploy.
 *
 * A path rather than a URL, deliberately: the archive is always wherever the
 * platform is, so there is no host to configure and no way for the card to
 * point somewhere the platform is not.
 */

export type Target = {
  /** Absolute path on this origin, no trailing slash. */
  path: string;
  /** Shown on the card, under the address. */
  label: string;
  /** Standing line above the card. */
  note: string;
};

/** A slug with no entry has no live target. */
const TARGETS_BY_SLUG: Record<string, Target> = {
  "stage-02": {
    path: "/archive",
    label: "HTTP // SHIELD SECURE ARCHIVE NODE",
    note: "Legacy archival host · reachable · degraded · out of scope for anything but reconnaissance",
  },
};

export function getTarget(slug: string): Target | null {
  return TARGETS_BY_SLUG[slug] ?? null;
}
