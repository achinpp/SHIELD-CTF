import { redirect } from "next/navigation";

/**
 * The briefing was the placeholder landing spot before the challenge board
 * existed. Kept as a redirect so older links and bookmarks do not dead-end.
 *
 * No auth check needed: /challenges performs its own, and sending an
 * unauthenticated visitor there produces the same redirect to the terminal.
 */
export default function Briefing() {
  redirect("/challenges");
}
