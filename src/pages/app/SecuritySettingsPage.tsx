import { useEffect, useState } from "react";
import { AppPageContainer } from "@/components/shared/AppPageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageMeta } from "@/components/layout/PageMeta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type SecurityState = {
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  twoFactorEnforcementRequired: boolean;
  twoFactorEnforcementAfter: string | null;
  isSuperAdmin: boolean;
};

export function SecuritySettingsPage() {
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/security", { credentials: "include" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setError(typeof payload.error === "string" ? payload.error : "Could not load security settings.");
          return;
        }
        setSecurity(payload.security ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load security settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const response = await fetch("/api/account/security", { credentials: "include" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Could not load security settings.");
      return;
    }
    setSecurity(payload.security ?? null);
  }

  async function startTotpEnrollment() {
    setError(null);
    setBusy(true);
    const enable = await authClient.twoFactor.enable({ password, method: "totp" });
    if (enable.error) {
      setBusy(false);
      setError(enable.error.message ?? "Could not start two-factor enrollment.");
      return;
    }
    if (enable.data?.method === "totp" && enable.data.backupCodes?.length) {
      setBackupCodes(enable.data.backupCodes);
    }
    const uri = await authClient.twoFactor.getTotpUri({ password });
    setBusy(false);
    if (uri.error || !uri.data?.totpURI) {
      setError(uri.error?.message ?? "Could not load authenticator setup.");
      return;
    }
    setTotpUri(uri.data.totpURI);
  }

  async function confirmTotp() {
    setBusy(true);
    const verified = await authClient.twoFactor.verifyTotp({ code: totpCode, trustDevice: false });
    setBusy(false);
    if (verified.error) {
      setError(verified.error.message ?? "Invalid code.");
      return;
    }
    setTotpUri(null);
    setTotpCode("");
    setPassword("");
    await reload();
  }

  async function disableTwoFactor() {
    setBusy(true);
    const result = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Could not disable two-factor authentication.");
      return;
    }
    setPassword("");
    await reload();
  }

  async function regenerateBackupCodes() {
    setBusy(true);
    const result = await authClient.twoFactor.generateBackupCodes({ password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Could not regenerate backup codes.");
      return;
    }
    setBackupCodes(result.data?.backupCodes ?? []);
  }

  return (
    <>
      <PageMeta title="Security | Kivorenta" description="Password and two-factor settings." canonicalPath="/app/settings/security/" />
      <AppPageContainer>
        <PageHeader title="Security" description="Protect your Kivorenta account." />
        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Account security</CardTitle>
              <CardDescription>Password and enforcement status</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span>Password change required</span>
                <Badge variant={security?.mustChangePassword ? "destructive" : "outline"}>
                  {security?.mustChangePassword ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Two-factor authentication</span>
                <Badge variant={security?.twoFactorEnabled ? "default" : "outline"}>
                  {security?.twoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {security?.isSuperAdmin && !security.twoFactorEnabled && security.twoFactorEnforcementAfter ? (
                <p className="text-muted-foreground">
                  Super-administrator accounts must enable 2FA by{" "}
                  {new Date(security.twoFactorEnforcementAfter).toLocaleString()}.
                </p>
              ) : null}
              {security?.mustChangePassword ? (
                <Button type="button" variant="outline" asChild>
                  <a href="/app/change-password/">Change password</a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>Use an authenticator app (Google Authenticator, 1Password, Bitwarden, etc.)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="security-password">Confirm with password</Label>
                <Input
                  id="security-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {!security?.twoFactorEnabled ? (
                <>
                  <Button type="button" disabled={busy || !password} onClick={() => void startTotpEnrollment()}>
                    Enable authenticator app
                  </Button>
                  {totpUri ? (
                    <div className="grid gap-2">
                      <p className="text-sm text-muted-foreground">
                        Add this account to your authenticator app using the setup key below or by scanning the URI in a
                        QR-enabled authenticator.
                      </p>
                      <p className="break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">{totpUri}</p>
                      <div className="grid gap-2">
                        <Label htmlFor="totp-code">Verification code</Label>
                        <Input id="totp-code" inputMode="numeric" value={totpCode} onChange={(event) => setTotpCode(event.target.value)} />
                        <Button type="button" disabled={busy || totpCode.length < 6} onClick={() => void confirmTotp()}>
                          Confirm enrollment
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" disabled={busy || !password} onClick={() => void regenerateBackupCodes()}>
                    Regenerate backup codes
                  </Button>
                  {!(security?.isSuperAdmin && security.twoFactorEnforcementRequired) ? (
                    <Button type="button" variant="destructive" disabled={busy || !password} onClick={() => void disableTwoFactor()}>
                      Disable 2FA
                    </Button>
                  ) : null}
                </>
              )}
              {backupCodes.length > 0 ? (
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <p className="mb-2 font-medium">Store these backup codes securely. They will not be shown again.</p>
                  <ul className="grid gap-1 font-mono">
                    {backupCodes.map((code) => (
                      <li key={code}>{code}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </AppPageContainer>
    </>
  );
}
