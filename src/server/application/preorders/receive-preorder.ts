import type { Preorder, Prisma } from "@prisma/client";
import { ApiError } from "@/server/api/errors";

const activeStatuses = ["planned", "ordered", "paid", "shipped"];

export async function receivePreorderLot(
  tx: Prisma.TransactionClient,
  root: Preorder & { children: Preorder[] },
  requestedDate?: string | null,
) {
  if (root.status !== "received" && !activeStatuses.includes(root.status))
    throw ApiError.conflict(
      "INVALID_PREORDER_TRANSITION",
      "A completed preorder requires an explicit reactivation command",
    );
  if (requestedDate === null)
    throw ApiError.badRequest(
      "RECEIVED_DATE_REQUIRED",
      "Received date cannot be null",
    );
  const now = new Date();
  const receivedDate = requestedDate
    ? new Date(requestedDate)
    : root.status === "received"
      ? (root.receivedDate ?? now)
      : now;
  const positions = [root, ...root.children];
  const changed = positions.filter((position) =>
    activeStatuses.includes(position.status),
  );
  const missingDate = positions.filter(
    (position) => position.status === "received" && !position.receivedDate,
  );
  const corrected =
    root.status === "received" && requestedDate
      ? positions.filter(
          (position) =>
            position.status === "received" &&
            (position.id === root.id ||
              position.receivedDate?.getTime() ===
                root.receivedDate?.getTime()),
        )
      : [];
  const paid = changed.filter(
    (position) => position.status === "paid" && position.fullyPaid === null,
  );
  if (paid.length)
    await tx.preorder.updateMany({
      where: { id: { in: paid.map(({ id }) => id) } },
      data: { fullyPaid: true },
    });
  if (changed.length || missingDate.length || corrected.length)
    await tx.preorder.updateMany({
      where: {
        id: {
          in: [...changed, ...missingDate, ...corrected].map(({ id }) => id),
        },
      },
      data: { status: "received", receivedDate },
    });
  if (!changed.length) return;
  await tx.preorderEvent.createMany({
    data: changed.map(({ id, status }) => ({
      preorderId: id,
      type: "status_changed",
      oldValue: status,
      newValue: "received",
    })),
  });
  const itemIds = [...new Set(changed.map(({ itemId }) => itemId))];
  await tx.userItem.createMany({
    data: itemIds.map((itemId) => ({
      itemId,
      owned: true,
      wishlist: false,
      status: "active",
      ownedAt: now,
    })),
    skipDuplicates: true,
  });
  // Preserve earlier ownership dates, including items already in the collection.
  await tx.userItem.updateMany({
    where: { itemId: { in: itemIds }, owned: false, ownedAt: null },
    data: { ownedAt: now },
  });
  await tx.userItem.updateMany({
    where: { itemId: { in: itemIds } },
    data: { owned: true, wishlist: false, status: "active" },
  });
}
