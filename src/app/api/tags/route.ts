import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/infrastructure/database/prisma";
import type { TagDto } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";

const createTagRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    color: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export async function GET() {
  return withApiErrorHandling(async () => {
    const tags = await prisma.tag.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(tags.map(mapTag));
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const input = await parseJsonBody(request, createTagRequestSchema);

    const tag = await prisma.tag.upsert({
      where: {
        name: input.name,
      },
      create: {
        name: input.name,
        color: input.color,
      },
      update: {
        color: input.color,
      },
    });

    return NextResponse.json(mapTag(tag), { status: 201 });
  });
}

function mapTag(tag: {
  id: string;
  name: string;
  color: string | null;
}): TagDto {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
}
