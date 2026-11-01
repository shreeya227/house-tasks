import { json, notFound, readJson, route } from "@/lib/http";
import { vapidPublicKey } from "@/lib/push";
import { householdByCode, personInHousehold } from "@/lib/repo";
import { issueToken } from "@/lib/tokens";
import type { JoinResponse } from "@/lib/types";

export const POST = route<{ code: string }>(async (req, { params }) => {
  const { code } = await params;
  const h = await householdByCode(code);
  if (!h) throw notFound("No such house");

  const body = await readJson<{ personId: number }>(req);
  const p = typeof body.personId === "number" ? await personInHousehold(h.id, body.personId) : null;
  if (!p) throw notFound("No such person");

  const res: JoinResponse = {
    personId: p.id,
    name: p.name,
    token: issueToken(p.id, h.id),
    vapidPublicKey: vapidPublicKey(),
  };
  return json(res);
});
