import type { Metadata } from "next";
import { ContactsView } from "@/components/pages/info-views";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("bg");
  return buildMetadata({
    lang: "bg",
    path: "/contacts",
    title: t.contacts.title,
    description: undefined,
  });
}

export default function Page() {
  return <ContactsView lang="bg" />;
}
