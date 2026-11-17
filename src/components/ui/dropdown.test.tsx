import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dropdown } from "./dropdown";

describe("shared dropdown fields", () => {
  it("uses a labelled combobox button and retains the named form control", () => {
    const markup = renderToStaticMarkup(
      <form>
        <label htmlFor="payment">Способ оплаты</label>
        <Dropdown
          id="payment"
          name="paymentType"
          defaultValue="installments"
          required
        >
          <option value="one_time">Единоразовый платёж</option>
          <option value="installments">Рассрочка</option>
        </Dropdown>
      </form>,
    );
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*role="combobox"/);
    expect(markup).toContain('id="payment"');
    expect(markup).toContain("Рассрочка");
    expect(markup).toMatch(/<select[^>]*required=""[^>]*name="paymentType"/);
    expect(markup.match(/name="paymentType"/g)).toHaveLength(1);
  });

  it("renders the empty choice used by filters and add-position fields", () => {
    const markup = renderToStaticMarkup(
      <Dropdown value="" aria-label="Дополнение">
        <option value="">Выберите дополнение</option>
        <option value="expansion">Новое дополнение</option>
      </Dropdown>,
    );
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Дополнение"');
    expect(markup).toContain("Выберите дополнение");
  });

  it("supports numeric values, fragments and conditional options", () => {
    const markup = renderToStaticMarkup(
      <Dropdown value="2" name="quarter">
        <>
          {null}
          {[1, 2, 3, 4].map((quarter) => (
            <option key={quarter} value={quarter}>
              Квартал {quarter}
            </option>
          ))}
        </>
      </Dropdown>,
    );
    expect(markup).toContain("Квартал 2");
    expect(markup).toContain('name="quarter"');
  });

  it("keeps disabled named fields disabled for form submission", () => {
    const markup = renderToStaticMarkup(
      <Dropdown name="typeId" defaultValue="base" disabled>
        <option value="base">Игра</option>
      </Dropdown>,
    );
    expect(markup).toMatch(/<button[^>]*disabled=""/);
    expect(markup).toMatch(/<select[^>]*name="typeId"[^>]*disabled=""/);
  });
});
