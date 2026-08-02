import type { ErpRole } from "@/domain/erp";

/**
 * The database and the application have always spelt the same five roles
 * differently. `erp_account_role_assignments.role` says `regional-manager`,
 * the app's `ErpRole` says `manager`; the AP and accounting RPCs are written
 * against the database spelling and their contract tests pin it.
 *
 * Renaming either side would mean rewriting working RPCs for no behavioural
 * gain, so the two vocabularies stay and the translation lives here — in one
 * place, tested. Two vocabularies with one authoritative map is fine; two
 * vocabularies translated ad hoc at each call site is how the registry drifted
 * out of sync with the org chart and locked three of four managers out of
 * supplier AP (mục 3 of docs/HANDOFF.md).
 */
export const ERP_REGISTRY_ROLES = [
  "employee",
  "regional-manager",
  "accountant-maker",
  "accounting-checker",
  "director",
  "system-admin",
] as const;

export type ErpRegistryRole = (typeof ERP_REGISTRY_ROLES)[number];

/**
 * `system-admin` deliberately has no `ErpRole`: it is a technical power
 * (create accounts, grant roles), not a job someone does in the product. A
 * person holds it *in addition to* their business role, which is exactly what
 * lets an audit line distinguish "the director approved a payment" from "the
 * director changed his own permissions".
 */
const APP_ROLE_BY_REGISTRY_ROLE: Readonly<
  Record<ErpRegistryRole, ErpRole | null>
> = Object.freeze({
  employee: "employee",
  "regional-manager": "manager",
  "accountant-maker": "accountant",
  "accounting-checker": "chief-accountant",
  director: "director",
  "system-admin": null,
});

const REGISTRY_ROLE_BY_APP_ROLE: Readonly<Record<ErpRole, ErpRegistryRole>> =
  Object.freeze({
    employee: "employee",
    manager: "regional-manager",
    accountant: "accountant-maker",
    "chief-accountant": "accounting-checker",
    director: "director",
  });

export const ERP_REGISTRY_ROLE_LABELS: Readonly<
  Record<ErpRegistryRole, string>
> = Object.freeze({
  employee: "Nhân viên",
  "regional-manager": "Quản lý cơ sở",
  "accountant-maker": "Kế toán tổng hợp",
  "accounting-checker": "Kế toán trưởng",
  director: "Giám đốc",
  "system-admin": "Quản trị hệ thống",
});

export function isErpRegistryRole(value: string): value is ErpRegistryRole {
  return (ERP_REGISTRY_ROLES as readonly string[]).includes(value);
}

export function appRoleFromRegistryRole(role: ErpRegistryRole): ErpRole | null {
  return APP_ROLE_BY_REGISTRY_ROLE[role];
}

export function registryRoleFromAppRole(role: ErpRole): ErpRegistryRole {
  return REGISTRY_ROLE_BY_APP_ROLE[role];
}

export type ErpAccountStatus = "active" | "suspended" | "revoked";

export const ERP_ACCOUNT_STATUS_LABELS: Readonly<
  Record<ErpAccountStatus, string>
> = Object.freeze({
  active: "Đang hoạt động",
  suspended: "Tạm khoá",
  revoked: "Đã thu hồi",
});

export function isErpAccountStatus(value: string): value is ErpAccountStatus {
  return value === "active" || value === "suspended" || value === "revoked";
}

/** Only `active` may sign in. Suspension has to bite at the door, or it is decoration. */
export function canAccountSignIn(status: ErpAccountStatus): boolean {
  return status === "active";
}
