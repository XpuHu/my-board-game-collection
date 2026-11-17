import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { runCommand } from "./command-receipt";

describe("commands on a remote database", () => {
  it("commits a command that takes longer than five seconds and safely replays its result", async () => {
    const id = randomUUID();
    const type = await prisma.itemType.findUniqueOrThrow({
      where: { code: "base_game" },
    });
    const title = `Slow command ${randomUUID()}`;
    let executions = 0;
    const execute = async (tx: Prisma.TransactionClient) => {
      executions += 1;
      const item = await tx.item.create({ data: { typeId: type.id, title } });
      await setTimeout(5100);
      await tx.userItem.create({ data: { itemId: item.id, status: "active" } });
      return { itemId: item.id };
    };
    const result = await runCommand(
      id,
      "slow-test-command",
      { title },
      execute,
    );
    expect(
      await runCommand(id, "slow-test-command", { title }, execute),
    ).toEqual(result);
    expect(executions).toBe(1);
    expect(
      await prisma.commandReceipt.findUnique({ where: { id } }),
    ).not.toBeNull();
    expect(await prisma.item.count({ where: { title } })).toBe(1);
    expect(
      await prisma.userItem.findUnique({ where: { itemId: result.itemId } }),
    ).not.toBeNull();
  }, 15000);
});
