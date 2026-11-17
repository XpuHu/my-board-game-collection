import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { ApiError } from "@/server/api/errors";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export async function runCommand<T>(
  id: string,
  kind: string,
  input: unknown,
  execute: (tx: Prisma.TransactionClient) => Promise<T>,
  prepare?: () => Promise<void>,
): Promise<T> {
  const fingerprint = createHash("sha256")
    .update(canonical(input))
    .digest("hex");
  function replay(receipt: {
    kind: string;
    fingerprint: string;
    result: string;
  }): T {
    if (receipt.kind !== kind || receipt.fingerprint !== fingerprint)
      throw ApiError.conflict(
        "OPERATION_CONFLICT",
        "This operation key was already used with different input",
      );
    return JSON.parse(receipt.result) as T;
  }
  if (prepare) {
    const previous = await prisma.commandReceipt.findUnique({ where: { id } });
    if (previous) return replay(previous);
    await prepare();
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const previous = await tx.commandReceipt.findUnique({ where: { id } });
        if (previous) return replay(previous);
        const result = await execute(tx);
        await tx.commandReceipt.create({
          data: { id, kind, fingerprint, result: JSON.stringify(result) },
        });
        return result;
      },
      // A preorder lot can import several positions and their taxonomy. The
      // whole command, including its receipt, must fit in the same transaction.
      { timeout: 30_000 },
    );
  } catch (error) {
    // Concurrent requests can race on the unique receipt. Only replay committed work.
    const committed = await prisma.commandReceipt.findUnique({ where: { id } });
    if (committed) return replay(committed);
    throw error;
  }
}
