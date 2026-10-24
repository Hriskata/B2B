import { AdminMenu } from "@/app/(bg)/admin/admin-menu";
import { getCurrentAdmin } from "@/lib/auth/current";

const ROLE_LABEL = {
  viewer: "Само преглед",
  editor: "Преглед и редакция",
} as const;

// The admin menu, shown on EVERY page (also the public site) to a logged-in
// admin with a complete session, and to nobody else: a guest or a customer
// gets nothing. Reads the session, so it must sit behind Suspense.
export async function AdminSidebar() {
  const admin = await getCurrentAdmin("full");
  if (!admin) return null;
  // An admin who still has the default password can reach only the password
  // change page, so the menu would only lead to redirects.
  if (admin.mustChangePassword) return null;
  return <AdminMenu email={admin.email} role={ROLE_LABEL[admin.role]} />;
}
