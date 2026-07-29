import type { PackageCatalogItem } from "@/content/packages";
import type { QuoteLine } from "@/domain/models";
import { DomainError } from "@/domain/errors";

export function calculateQuoteLines(input: {
  selections: Array<{ product: PackageCatalogItem; quantity: number }>;
}) {
  const lines: QuoteLine[] = input.selections.map(({ product, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Package quantity must be an integer between 1 and 20.",
      );
    }
    if (product.ledgerType !== "service-commerce") {
      throw new DomainError(
        "PERMISSION_DENIED",
        "Visitor checkout supports service-commerce only.",
      );
    }
    if (!Number.isInteger(product.demoPriceVnd)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Demonstration price must be integer VND.",
      );
    }
    return {
      productId: product.id,
      quantity,
      unitPriceVnd: product.demoPriceVnd,
      totalVnd: product.demoPriceVnd * quantity,
      ledgerType: product.ledgerType,
    };
  });
  const subtotalVnd = lines.reduce(
    (total, line) =>
      line.ledgerType === "service-commerce" ? total + line.totalVnd : total,
    0,
  );
  return { lines, subtotalVnd, totalVnd: subtotalVnd, currency: "VND" as const };
}

export function maskContact(contact: string) {
  const trimmed = contact.trim();
  if (trimmed.includes("@")) {
    const [name, domain] = trimmed.split("@");
    return `${name.slice(0, 1)}***@${domain}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "***";
}

export function buildPrivacySafePassPath(token: string) {
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(token)) {
    throw new DomainError("VALIDATION_ERROR", "Pass token is not opaque.");
  }
  return `/pass/${encodeURIComponent(token)}`;
}

export type SandboxPaymentStatus =
  | "pending"
  | "failed"
  | "cancelled"
  | "succeeded";

export function reduceSandboxPaymentStatus(
  current: SandboxPaymentStatus,
  event: "approved" | "declined" | "cancelled",
): SandboxPaymentStatus {
  if (current === "succeeded") return "succeeded";
  if (event === "approved") return "succeeded";
  if (event === "declined") return "failed";
  return "cancelled";
}
