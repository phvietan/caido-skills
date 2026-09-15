/** Info commands: viewer, plugins, health, setup, auth-status */

import { CaidoClient } from "../client";
import { CaidoGlobalSettings } from "../settings";

export async function cmdViewer() {
  const client = await CaidoClient.getClient();
  const viewer = await client.viewer();
  console.log(JSON.stringify(viewer, null, 2));
}

export async function cmdPlugins() {
  const client = await CaidoClient.getClient();
  const plugins = await client.plugins();
  console.log(JSON.stringify(plugins, null, 2));
}

export async function cmdHealth() {
  const client = await CaidoClient.getClient();
  const health = await client.health();
  console.log(JSON.stringify(health, null, 2));
}

export async function cmdSetup(pat: string, url: string, proxy?: string) {
  console.log(`Connecting to ${url}...`);

  // Cache the access token under THIS instance's slot (clear any stale one first).
  const instance = CaidoGlobalSettings.instance(url);
  instance.clearCachedToken();

  const client = CaidoClient.withAuth(instance, pat);

  try {
    await client.connect({
      ready: { retries: 3, timeout: 5000, interval: 1000 },
    });
  } catch (err: any) {
    console.error(`Failed to connect: ${err.message}`);
    console.error("\nMake sure:");
    console.error(`  1. Caido is running at ${url}`);
    console.error(
      "  2. The PAT was created in Caido → Settings → Developer → Personal Access Tokens",
    );
    process.exit(1);
  }

  const viewer = await client.viewer();
  console.log(
    `Authenticated as: ${(viewer as any).username || (viewer as any).id || JSON.stringify(viewer)}`,
  );

  // Persist PAT (+ proxy) under instances[url] and make it the active default.
  // The access token was already cached under instances[url] during connect.
  instance.update({ pat, ...(proxy ? { proxy } : {}) }, true);

  console.log(`\nSaved to ${CaidoGlobalSettings.path} (instance: ${url})`);
  console.log(`PAT: ${pat.slice(0, 12)}...`);
  console.log(`Access token: cached`);
  console.log(`Proxy (curl -x): ${instance.proxy()}`);
  console.log(
    `\nActive instance is now ${url}. Switch instances per shell with CAIDO_URL=<url>.`,
  );
}

export async function cmdAuthStatus() {
  const root = CaidoGlobalSettings.read();
  const instance = CaidoGlobalSettings.activeInstance(root);
  const url = instance.url;
  const pat = instance.pat;

  const cachedTokenValid = instance.isCachedTokenValid();
  const cachedTokenExpiresAt = instance.cachedToken?.expiresAt ?? null;
  const authMode = pat ? "pat" : cachedTokenValid ? "cached-token" : "none";

  const base = {
    activeUrl: url,
    defaultUrl: root.default ?? null,
    configuredInstances: Object.keys(root.instances ?? {}),
    authMode,
    cachedTokenExpiresAt,
    cachedTokenValid,
    proxy: instance.proxy(),
  };

  if (!pat && !cachedTokenValid) {
    console.log(
      JSON.stringify(
        {
          authenticated: false,
          ...base,
          error: `No usable auth for ${url}. Run: setup <pat> ${url}  (or set CAIDO_PAT / CAIDO_URL).`,
        },
        null,
        2,
      ),
    );
    return;
  }

  const client = CaidoClient.withAuth(instance, pat || "");

  try {
    await client.connect({
      ready: { retries: 2, timeout: 3000, interval: 1000 },
    });
    const viewer = await client.viewer();
    const health = await client.health();
    console.log(
      JSON.stringify(
        { authenticated: true, ...base, user: viewer, health },
        null,
        2,
      ),
    );
  } catch (err: any) {
    console.log(
      JSON.stringify(
        { authenticated: false, ...base, error: err.message },
        null,
        2,
      ),
    );
  }
}
