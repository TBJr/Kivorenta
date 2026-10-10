import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { PageMeta } from "@/components/layout/PageMeta";

export function ResetPasswordPage() {
  return (
    <>
      <PageMeta
        title="Choose new password | Kivorenta"
        description="Set a new password for your Kivorenta account."
        canonicalPath="/reset-password/"
      />
      <ResetPasswordForm />
    </>
  );
}
