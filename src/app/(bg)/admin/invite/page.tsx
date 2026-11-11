import type { Metadata } from "next";
import { Suspense } from "react";
import { isEmailTokenUsable } from "@/lib/auth/tokens";
import { ResetPasswordForm } from "../../(auth)/reset-password/reset-form";
import { adminAcceptInviteAction } from "../actions";

export const metadata: Metadata = {
  title: "Покана за администратор",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// The link from the invite mail: the new admin sets their own password here.
// Opening the page does not use the link up (mail scanners open links).
export default function AdminInvitePage({ searchParams }: PageProps<"/admin/invite">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Задаване на парола</h1>
      <Suspense>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/admin/invite">["searchParams"];
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  if (!(await isEmailTokenUsable(value, "admin_invite", "admin"))) {
    return (
      <p>
        Връзката е невалидна или е изтекла. Помолете друг администратор да ви изпрати нова
        покана.
      </p>
    );
  }
  return <ResetPasswordForm action={adminAcceptInviteAction} token={value} />;
}
