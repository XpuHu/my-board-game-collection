import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/server/api/errors";
import { exportJsonBackup } from "@/server/application/backup/backup-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    const backup = await exportJsonBackup();
    const exportedAt = backup.exportedAt.replaceAll(":", "-");

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Disposition": `attachment; filename="board-game-collection-${exportedAt}.json"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  });
}
