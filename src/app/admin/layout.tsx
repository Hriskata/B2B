import type { Metadata } from "next";

// The admin area must not be indexed (checklist I).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
