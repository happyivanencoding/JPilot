"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ProfileOption = { id: string; name: string; shortName: string; legacyUntagged?: boolean };

type ProfileContextValue = {
  profileId: string;
  profile: ProfileOption;
  profiles: ProfileOption[];
  switching: boolean;
  switchProfile: (profileId: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used within <ProfileProvider>");
  return value;
}

export function ProfileProvider({
  initialProfileId,
  profiles,
  children,
}: {
  initialProfileId: string;
  profiles: ProfileOption[];
  children: React.ReactNode;
}) {
  const [profileId, setProfileId] = useState(initialProfileId);
  const [switching, setSwitching] = useState(false);
  const profile = useMemo(
    () => profiles.find((item) => item.id === profileId) ?? profiles[0],
    [profileId, profiles],
  );

  const switchProfile = async (nextProfileId: string) => {
    if (!nextProfileId || nextProfileId === profileId || switching) return;
    setSwitching(true);
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: nextProfileId }),
      });
      if (!response.ok) throw new Error("Impossible de changer de profil");
      setProfileId(nextProfileId);
      // Server-rendered pages, route handlers and all client stores must observe
      // one coherent profile boundary. A reload is deliberate: it prevents a
      // long-lived provider from briefly mixing snapshots from two candidates.
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  };

  if (!profile) return <>{children}</>;

  return (
    <ProfileContext.Provider value={{ profileId, profile, profiles, switching, switchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
