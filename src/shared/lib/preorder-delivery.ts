export const preorderDeliveryMethods = [
  "unspecified",
  "pickup",
  "pickup_point",
] as const;
export type PreorderDeliveryMethod = (typeof preorderDeliveryMethods)[number];
export const preorderDeliveryLabels: Record<PreorderDeliveryMethod, string> = {
  unspecified: "Не указан",
  pickup: "Самовывоз",
  pickup_point: "Пункт выдачи",
};

export function preorderTotal(preorder: {
  price: { amount: number };
  deliveryCost?: number | null;
}) {
  return (
    (Math.round(preorder.price.amount * 100) +
      Math.round((preorder.deliveryCost ?? 0) * 100)) /
    100
  );
}
