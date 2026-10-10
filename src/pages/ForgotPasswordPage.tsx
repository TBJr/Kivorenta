import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { PageMeta } from "@/components/layout/PageMeta";

export function ForgotPasswordPage() {
  return (
    <>
      <PageMeta
        title="Reset password | Kivorenta"
        description="Reset your Kivorenta account password."
        canonicalPath="/forgot-password/"
      />
      <ForgotPasswordForm />
    </>
  );
}
