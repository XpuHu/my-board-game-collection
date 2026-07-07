import { NextResponse } from "next/server";

import { jsonBackupSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { parseJsonBody } from "@/server/api/request";
import { importJsonBackup } from "@/server/application/backup/backup-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const input = await parseJsonBody(request, jsonBackupSchema);

    return NextResponse.json(await importJsonBackup(input));
  });
}
