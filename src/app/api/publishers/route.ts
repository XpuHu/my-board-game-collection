import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { withApiErrorHandling } from "@/server/api/errors";
import { normalizeTaxonomyName } from "@/server/application/items/taxonomy-service";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const q = normalizeTaxonomyName(
      new URL(request.url).searchParams.get("q") ?? "",
    ).slice(0, 150);
    return NextResponse.json(
      await prisma.publisher.findMany({
        where: q ? { normalizedName: { contains: q } } : {},
        select: { id: true, name: true },
        orderBy: { normalizedName: "asc" },
        take: 60,
      }),
    );
  });
}
