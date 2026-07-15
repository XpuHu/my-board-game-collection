import type {
  UserItemLifecycleStatus,
  UserItemState,
} from "@/shared/api";

type StateSource = {
  status: string;
  owned: boolean;
  wishlist: boolean;
  hasActivePreorder?: boolean;
  hasPlays?: boolean;
};

const lifecycleStatuses = new Set(["for_sale", "sold", "archived"]);

export function resolveLifecycleStatus(status: string): UserItemLifecycleStatus {
  return lifecycleStatuses.has(status)
    ? (status as UserItemLifecycleStatus)
    : "active";
}

export function resolveUserItemStates(source: StateSource): UserItemState[] {
  const states: UserItemState[] = [];

  if (source.owned) states.push("owned");
  if (source.wishlist) states.push("wishlist");
  if (source.hasActivePreorder) states.push("preordered");
  if (source.hasPlays) states.push("played");

  const lifecycleStatus = resolveLifecycleStatus(source.status);
  if (lifecycleStatus !== "active") states.push(lifecycleStatus);

  return states;
}
