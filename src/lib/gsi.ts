/**
 * Google Identity Services (One Tap) helper.
 *
 * Loads the GSI client, shows the One Tap prompt, and resolves with the Google
 * ID token (JWT). That JWT is handed to Magic via loginWithGoogleIdToken — the
 * user never leaves the page. Requires the app origin in "Authorized JavaScript
 * origins" on the Google OAuth client.
 */

type GsiId = {
  initialize: (cfg: {
    client_id: string;
    callback: (resp: { credential?: string }) => void;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: (listener?: (n: {
    isNotDisplayed?: () => boolean;
    isSkippedMoment?: () => boolean;
    getNotDisplayedReason?: () => string;
  }) => void) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiId } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise: Promise<GsiId> | null = null;

function loadGsi(): Promise<GsiId> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("GSI loaded but accounts.id unavailable"));
    };
    script.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/** Shows the One Tap prompt and resolves with the Google ID token (JWT). */
export async function promptGoogleOneTap(clientId: string): Promise<string> {
  const accountsId = await loadGsi();
  return new Promise<string>((resolve, reject) => {
    accountsId.initialize({
      client_id: clientId,
      use_fedcm_for_prompt: true,
      callback: (resp) => {
        if (resp?.credential) resolve(resp.credential);
        else reject(new Error("Google sign-in returned no credential"));
      },
    });
    accountsId.prompt((n) => {
      if (n.isNotDisplayed?.())
        reject(
          new Error(
            `Google One Tap not shown${
              n.getNotDisplayedReason ? `: ${n.getNotDisplayedReason()}` : ""
            }`,
          ),
        );
    });
  });
}

/** Best-effort email from a Google ID token (JWT), for display only. */
export function emailFromIdToken(jwt: string): string | null {
  try {
    const payload = JSON.parse(
      atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
