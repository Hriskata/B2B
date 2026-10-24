import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentAdmin } from "@/lib/auth/current";
import { AdminMenu } from "./admin-menu";

// The admin area must not be indexed (checklist I).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// A column menu on the left on a laptop or desktop; a collapsible menu above
// the page on smaller screens. Without a complete session (login, 2FA pages)
// there is no menu and the page uses the full width.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Reads the session, so it streams in behind Suspense. */}
      <Suspense fallback={null}>
        <AdminSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

const ROLE_LABEL = {
  viewer: "Само преглед",
  editor: "Преглед и редакция",
} as const;

async function AdminSidebar() {
  const admin = await getCurrentAdmin("full");
  if (!admin) return null;
  // An admin who still has the default password can reach only the password
  // change page, so the menu would only lead to redirects.
  if (admin.mustChangePassword) return null;
  return <AdminMenu email={admin.email} role={ROLE_LABEL[admin.role]} />;
}
