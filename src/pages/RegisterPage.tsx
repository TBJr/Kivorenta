import { RegisterForm } from "@/components/auth/RegisterForm";
import { PageMeta } from "@/components/layout/PageMeta";

export function RegisterPage() {
  return (
    <>
      <PageMeta
        title="Create account | Kivorenta"
        description="Create a Kivorenta account for TBJr."
        canonicalPath="/register/"
      />
      <RegisterForm />
    </>
  );
}
