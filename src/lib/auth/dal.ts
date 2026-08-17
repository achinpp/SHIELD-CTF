import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { readSession, type SessionUser } from "@/lib/auth/session";

/**
 * Data access layer.
 *
 * Authorisation is checked here rather than in a layout: layouts do not
 * re-render on every navigation and do not stop nested segments or Server
 * Actions from running, so a check there is not a gate. Anything that needs
 * an authenticated agent calls one of these.
 *
 * `cache` deduplicates within a single render pass, so a page and the
 * components inside it share one lookup instead of querying per component.
 */

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return readSession();
});

/** Require an authenticated agent, or bounce to the terminal. */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) redirect("/?access=required");
  return user;
});
