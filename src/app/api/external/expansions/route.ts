import { NextResponse } from "next/server";
import { z } from "zod";
import { providerCodeSchema } from "@/shared/api";
import { withApiErrorHandling } from "@/server/api/errors";
import { getExternalExpansionOptions } from "@/server/application/items/expansion-options-service";
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await getExternalExpansionOptions(
        {
          provider: providerCodeSchema.parse(params.get("provider")),
          externalId: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .parse(params.get("externalId")),
        },
        params.get("kind") === "accessory" ? "accessory" : "expansion",
      ),
    );
  });
}
