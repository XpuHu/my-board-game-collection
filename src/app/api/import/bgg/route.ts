import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrorHandling } from "@/server/api/errors";
import {
  previewBggCollection,
  previewBggEntries,
  parseBggCollection,
  applyBggCollectionEntry,
  bggCollectionEntrySchema,
} from "@/server/application/collection/bgg-import";
export async function GET(request: Request) {
  return withApiErrorHandling<unknown>(async () => {
    const username = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get("username"));
    return NextResponse.json(await previewBggCollection(username));
  });
}
export async function POST(request: Request) {
  return withApiErrorHandling<unknown>(async () => {
    const body = await request.json();
    if ("xml" in body) {
      const xml = z.string().max(10000000).parse(body.xml);
      return NextResponse.json(
        await previewBggEntries(parseBggCollection(xml)),
      );
    }
    const input = z
      .object({
        operationId: z.string().uuid(),
        entry: bggCollectionEntrySchema,
      })
      .strict()
      .parse(body);
    return NextResponse.json(
      await applyBggCollectionEntry(input.operationId, input.entry),
    );
  });
}
