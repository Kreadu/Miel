import { describe, expect, it } from "vitest";

import { customerPaymentSchema } from "./customer-payments";

const validPayment = {
  customer_id: "11111111-1111-4111-8111-111111111111",
  sale_id: "22222222-2222-4222-8222-222222222222",
  amount: 40,
  method: "transfer",
};

describe("customerPaymentSchema", () => {
  it("acepta un pago válido asociado a una venta", () => {
    expect(customerPaymentSchema.safeParse(validPayment).success).toBe(true);
  });

  it("acepta un pago sin sale_id (anticipo)", () => {
    const { customer_id, amount, method } = validPayment;
    expect(customerPaymentSchema.safeParse({ customer_id, amount, method }).success).toBe(true);
  });

  it("acepta sale_id vacío (formulario sin venta asociada)", () => {
    expect(customerPaymentSchema.safeParse({ ...validPayment, sale_id: "" }).success).toBe(true);
  });

  it("rechaza amount cero o negativo", () => {
    expect(customerPaymentSchema.safeParse({ ...validPayment, amount: 0 }).success).toBe(false);
    expect(customerPaymentSchema.safeParse({ ...validPayment, amount: -1 }).success).toBe(false);
  });

  it("rechaza un method fuera del enum", () => {
    expect(customerPaymentSchema.safeParse({ ...validPayment, method: "bitcoin" }).success).toBe(false);
  });

  it("rechaza customer_id inválido", () => {
    expect(customerPaymentSchema.safeParse({ ...validPayment, customer_id: "no-uuid" }).success).toBe(false);
  });

  it("nota es opcional", () => {
    const result = customerPaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it("rechaza nota muy larga", () => {
    expect(
      customerPaymentSchema.safeParse({ ...validPayment, note: "a".repeat(501) }).success,
    ).toBe(false);
  });
});
