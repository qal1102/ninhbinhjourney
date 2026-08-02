import { describe, expect, it } from "vitest";
import { ERP_ROLE_LABELS, type ErpRole } from "@/domain/erp";
import {
  ERP_REGISTRY_ROLES,
  appRoleFromRegistryRole,
  canAccountSignIn,
  isErpAccountStatus,
  isErpRegistryRole,
  registryRoleFromAppRole,
} from "@/domain/erp-account-roles";

describe("registry role vocabulary", () => {
  it("round-trips every application role through the database spelling", () => {
    // The two vocabularies exist because the AP and accounting RPCs are
    // written against 'regional-manager' and friends. What must never happen
    // again is a mapping that loses a role on the way: the registry drifting
    // out of step with the org chart is what locked three of four managers out
    // of supplier AP.
    for (const role of Object.keys(ERP_ROLE_LABELS) as ErpRole[]) {
      const registryRole = registryRoleFromAppRole(role);
      expect(isErpRegistryRole(registryRole), role).toBe(true);
      expect(appRoleFromRegistryRole(registryRole), role).toBe(role);
    }
  });

  it("keeps system-admin outside the business roles", () => {
    // It is a technical power held *in addition to* a job, which is what lets
    // the audit trail tell "approved a payment" apart from "changed his own
    // permissions".
    expect(appRoleFromRegistryRole("system-admin")).toBeNull();
    const businessRoles = ERP_REGISTRY_ROLES.filter(
      (role) => appRoleFromRegistryRole(role) !== null,
    );
    expect(businessRoles.length).toBe(Object.keys(ERP_ROLE_LABELS).length);
  });

  it("lets only an active account through the door", () => {
    expect(canAccountSignIn("active")).toBe(true);
    expect(canAccountSignIn("suspended")).toBe(false);
    expect(canAccountSignIn("revoked")).toBe(false);
    expect(isErpAccountStatus("deleted")).toBe(false);
  });
});
