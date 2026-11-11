import type { Metadata } from "next";
import { Suspense } from "react";
import { listAdmins } from "@/lib/admin/admins";
import { requireAdmin } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { AddAdminForm } from "./add-admin-form";
import { resendAdminInviteAction } from "../manage-actions";
import { ResetTwoFactorForm } from "./reset-form";

export const metadata: Metadata = { title: "Админи" };

const ROLE_LABEL = {
  viewer: "Само преглед",
  editor: "Преглед и редакция",
} as const;

export default function AdminAdminsPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8">
      <h1 className="mb-6">Администратори</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

// New admins are added here (role "Преглед и редакция" only): they get an
// emailed link to set their own password, which can be sent again while they
// have none. The admin:create script still works too.
async function Content() {
  const me = await requireAdmin();
  const admins = await listAdmins();
  const canReset = can(me.role, "reset_admin_2fa");
  const canManage = can(me.role, "manage_admins");
  return (
    <div className="flex flex-col gap-8">
      {can(me.role, "manage_admins") && (
        <section aria-labelledby="add-admin">
          <h2 id="add-admin" className="mb-3">
            Добавяне на администратор
          </h2>
          <AddAdminForm />
        </section>
      )}
      <section aria-labelledby="admin-list">
        <h2 id="admin-list" className="mb-3">
          Списък
        </h2>
        <ul className="flex flex-col gap-4">
          {admins.map((a) => (
            <li key={a.id} className="card card-pad">
              <p className="font-medium">
                {a.email}
                {a.id === me.id && (
                  <span className="ml-2 text-sm font-normal">(вие)</span>
                )}
                {a.isTest && (
                  <span className="pill ml-2 align-middle">тестов акаунт</span>
                )}
              </p>
              <p className="text-sm text-secondary">
                {ROLE_LABEL[a.role]} ·{" "}
                {a.status === "active" ? "Активен" : "Блокиран"} · 2FA:{" "}
                {a.totpEnabledAt ? "включена" : "не е настроена"}
                {a.passwordMustChange && " · още не е задал собствена парола"}
              </p>
              {canManage && a.passwordMustChange && a.status === "active" && (
                <form action={resendAdminInviteAction} className="mt-2 text-sm">
                  <input type="hidden" name="adminId" value={a.id} />
                  <button type="submit" className="underline">
                    Изпрати поканата отново
                  </button>
                </form>
              )}
              {canReset && a.id !== me.id && (
                <ResetTwoFactorForm targetId={a.id} targetEmail={a.email} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
