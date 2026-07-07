import { NextResponse } from "next/server";

import { prisma } from "@/infrastructure/database/prisma";
import type { ItemTypeDto } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";

export async function GET() {
  return withApiErrorHandling(async () => {
    const itemTypes = await prisma.itemType.findMany({
      orderBy: [
        {
          isSystem: "desc",
        },
        {
          name: "asc",
        },
      ],
    });

    return NextResponse.json(itemTypes.map(mapItemType));
  });
}

function mapItemType(itemType: {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
}): ItemTypeDto {
  return {
    id: itemType.id,
    code: itemType.code as ItemTypeDto["code"],
    name: itemType.name,
    isSystem: itemType.isSystem,
  };
}
