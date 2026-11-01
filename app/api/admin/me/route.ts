import { json, requireSession, route } from "@/lib/http";

/** Am I an admin? Decides whether the Setup tab shows at all. */
export const GET = route(async (req) => {
  const { me } = await requireSession(req);
  return json({ isAdmin: me.isAdmin });
});
