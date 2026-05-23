import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { serializeContact } from "@/lib/serializers";

const createSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  source: z.string().max(120).optional(),
});

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    contacts: contacts.map(serializeContact),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  let parsed;
  try {
    parsed = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      userId,
      name: parsed.name?.trim() || "Sem nome",
      source: parsed.source?.trim() || "Origem indefinida",
    },
    include: { messages: true },
  });

  return NextResponse.json({ contact: serializeContact(contact) }, { status: 201 });
}
