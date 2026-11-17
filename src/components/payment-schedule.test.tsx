import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentSchedule } from "./payment-schedule";

describe("fully paid preorder display", () => {
  it("hides the graph for an explicit full payment even with unpaid saved rows", () => {
    const props = {
      id: "order",
      total: 100,
      currency: "RUB",
      status: "shipped",
      initialRows: [
        { id: "row", date: "2027-01-01", amount: "100", paid: false },
      ],
    };
    const markup = renderToStaticMarkup(
      <PaymentSchedule {...props} fullyPaid />,
    );
    expect(markup).toContain("Полностью оплачен");
    expect(markup).not.toContain("График оплаты");
    expect(markup).not.toContain("Следующий платёж");
    expect(
      renderToStaticMarkup(<PaymentSchedule {...props} fullyPaid={false} />),
    ).toContain("График оплаты");
  });
});
