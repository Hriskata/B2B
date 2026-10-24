import type { Metadata } from "next";

// The admin area must not be indexed (checklist I).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The admin menu itself is part of the shared site frame (SiteShell), so it
// stays on screen when an admin opens a public page too.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <>{children}</>;
}
