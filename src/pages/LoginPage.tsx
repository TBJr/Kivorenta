import { LoginForm } from "@/components/auth/LoginForm";
import { PageMeta } from "@/components/layout/PageMeta";

export function LoginPage() {
  return (
    <>
      <PageMeta
        title="Sign in | Kivorenta"
        description="Sign in to the Kivorenta workspace for TBJr."
        canonicalPath="/login/"
      />
      <LoginForm />
    </>
  );
}
