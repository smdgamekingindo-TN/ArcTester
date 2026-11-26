import { useEffect, useState } from "react";
import { request } from "./apiClient";
import AdminSettings from "./AdminSettings";
import AccountSecurityPanel from "./AccountSecurityPanel";

type AdminProfile = {
  id: number;
  email: string;
  role: string;
  accessStatus?: string;
  fullName?: string | null;
  collegeName?: string | null;
  collegeCode?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
};

type Props = {
  email: string;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  onSignOut: () => void;
};

export default function AdminAccountPage({ email, theme, onThemeChange, onSignOut }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;
    request<{ user: AdminProfile }>("/auth/me")
      .then((result) => { if (active) setProfile(result.user); })
      .catch((error: unknown) => {
        if (active) setProfileError(error instanceof Error ? error.message : "Could not load account details.");
      });
    return () => { active = false; };
  }, []);

  if (settingsOpen) {
    return (
      <section className="admin-account-page">
        <header className="admin-page-title admin-account-heading">
          <div><p className="eyebrow">ACCOUNT PREFERENCES</p><h1>Settings</h1><p>Manage administrator security and personal workspace preferences.</p></div>
          <button type="button" className="ghost" onClick={() => setSettingsOpen(false)}>← Back to account</button>
        </header>
        <AccountSecurityPanel email={email} onSignOut={onSignOut} />
        <AdminSettings theme={theme} onThemeChange={onThemeChange} />
      </section>
    );
  }

  return (
    <section className="admin-account-page">
      <header className="admin-page-title admin-account-heading">
        <div><p className="eyebrow">YOUR ACCOUNT</p><h1>Account</h1><p>View your administrator profile and account information.</p></div>
        <button type="button" className="primary" onClick={() => setSettingsOpen(true)}>Settings</button>
      </header>
      <article className="admin-panel admin-account-profile">
        <p className="eyebrow">PROFILE</p>
        <div className="admin-account-profile-header">
          <span className="admin-account-avatar">{(profile?.fullName || email).trim().slice(0, 1).toUpperCase()}</span>
          <div><h2>{profile?.fullName || "Administrator"}</h2><p>{profile?.email || email}</p></div>
        </div>
        {profileError ? <p className="security-form-message error" role="alert">{profileError}</p> : null}
        <div className="admin-account-details">
          <div><span>Full name</span><strong>{profile?.fullName || "Not set"}</strong></div>
          <div><span>Email address</span><strong>{profile?.email || email}</strong></div>
          <div><span>Account ID</span><strong>{profile?.id ?? "Loading…"}</strong></div>
          <div><span>Account type</span><strong>Administrator</strong></div>
          <div><span>Access status</span><strong>{profile?.accessStatus || "Active"}</strong></div>
          <div><span>College / Polytechnic</span><strong>{profile?.collegeName || "Not specified"}{profile?.collegeCode ? " · " + profile.collegeCode : ""}</strong></div>
          <div><span>Branch</span><strong>{profile?.branchName || "Not specified"}{profile?.branchCode ? " · " + profile.branchCode : ""}</strong></div>
        </div>
      </article>
      <article className="admin-panel admin-account-security-summary">
        <p className="eyebrow">ACCOUNT SECURITY</p>
        <h2>Keep your administrator account protected</h2>
        <p className="muted">Configure an authenticator, add a passkey, and review active devices and sign-in history from Settings.</p>
        <button type="button" className="ghost" onClick={() => setSettingsOpen(true)}>Open security settings</button>
      </article>
    </section>
  );
}
