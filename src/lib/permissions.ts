// What each admin role may do. One place, checked on the SERVER by every
// admin action and page; the UI only hides buttons as a convenience.
//
// Two roles, as decided: "viewer" (view only) and "editor" (view + edit).
// Who may approve registrations and reset another admin's 2FA is an
// assumption of the plan (editor only).

export type AdminRole = "viewer" | "editor";

export type Permission =
  | "view" // see products, customers, admins and the journal
  | "edit_catalog" // create/edit products and prices
  | "block_accounts" // block/unblock customers and companies
  | "reset_admin_2fa" // reset another admin's 2FA
  | "manage_admins"; // add a new admin

const GRANTS: Record<AdminRole, readonly Permission[]> = {
  viewer: ["view"],
  editor: [
    "view",
    "edit_catalog",
    "block_accounts",
    "reset_admin_2fa",
    "manage_admins",
  ],
};

export function can(role: AdminRole, permission: Permission): boolean {
  return GRANTS[role]?.includes(permission) ?? false;
}
