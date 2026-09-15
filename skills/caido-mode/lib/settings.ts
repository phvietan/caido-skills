/** Application-owned settings and credential storage for caido-client. */

import type { CachedToken } from "@caido/sdk-client";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { canonicalUrl } from "./helper";

export interface CaidoInstanceData {
  pat?: string;
  proxy?: string;
  cachedToken?: CachedToken;
}

export interface CaidoSettingSchema {
  default?: string;
  instances?: Record<string, CaidoInstanceData>;
}

export type AuthMode = "pat" | "cached-token";

export interface CaidoConfig {
  url: string;
  pat: string;
  authMode: AuthMode;
}

export class CaidoInstance {
  readonly url: string;

  constructor(
    url: string,
    private data: CaidoInstanceData = {},
  ) {
    this.url = canonicalUrl(url);
  }

  get cachedToken(): CachedToken | undefined {
    return this.data.cachedToken;
  }

  get pat(): string | undefined {
    return process.env.CAIDO_PAT || this.data.pat;
  }

  proxy(): string {
    return process.env.CAIDO_PROXY || this.data.proxy || this.url;
  }

  isCachedTokenValid(): boolean {
    const token = this.data.cachedToken;
    if (!token?.accessToken || !token.expiresAt) return false;
    const expiresAt = Date.parse(token.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  }

  update(patch: Partial<CaidoInstanceData>, setDefault = false): void {
    CaidoGlobalSettings.upsert(this.url, patch, setDefault);
    this.data = { ...this.data, ...patch };
  }

  clearCachedToken(): void {
    CaidoGlobalSettings.clearCachedToken(this.url);
    delete this.data.cachedToken;
  }

  loadConfig(): CaidoConfig {
    const pat = this.pat;
    if (pat) return { url: this.url, pat, authMode: "pat" };
    if (this.isCachedTokenValid()) {
      return { url: this.url, pat: "", authMode: "cached-token" };
    }

    if (this.data.cachedToken?.accessToken) {
      console.error(
        `Error: Cached access token for ${this.url} expired at ${this.data.cachedToken.expiresAt}.`,
      );
      console.error(`Re-run: caido-client setup <pat> ${this.url}`);
    } else {
      console.error(`Error: No Caido auth found for instance ${this.url}.`);
      console.error(
        "  - No PAT in env (CAIDO_PAT) or stored for this instance",
      );
      console.error("  - No unexpired cached token for this instance");
      console.error("");
      console.error(`Setup: caido-client setup <pat> ${this.url}`);
      console.error(
        "(Select an instance with CAIDO_URL or the stored default.)",
      );
    }
    process.exit(1);
  }
}

export class CaidoGlobalSettings {
  static readonly defaultUrl = "http://localhost:8080";
  static readonly directory = join(homedir(), ".config", "caido-client");
  static readonly legacyPath = join(
    homedir(),
    ".claude",
    "config",
    "secrets.json",
  );

  static get path(): string {
    return (
      process.env.CAIDO_SETTINGS_PATH || join(this.directory, "settings.json")
    );
  }

  static read(): CaidoSettingSchema {
    const current = this.readJson(this.path);
    if (current) return this.normalize(current);

    if (!process.env.CAIDO_SETTINGS_PATH) {
      const legacy = this.readJson(this.legacyPath)?.caido;
      if (legacy) {
        const migrated = this.normalize(legacy);
        this.write(migrated);
        return migrated;
      }
    }

    return { instances: {} };
  }

  static write(root: CaidoSettingSchema): void {
    const path = this.path;
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true, mode: 0o700 });

    const normalized = this.normalize(root);
    const tmp = `${path}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(normalized, null, 2), { mode: 0o600 });
    renameSync(tmp, path);
    chmodSync(path, 0o600);
  }

  static upsert(
    url: string,
    patch: Partial<CaidoInstanceData>,
    setDefault = false,
  ): void {
    const key = canonicalUrl(url);
    const root = this.read();
    root.instances = root.instances ?? {};
    root.instances[key] = { ...root.instances[key], ...patch };
    if (setDefault || !root.default) root.default = key;
    this.write(root);
  }

  static instance(url: string, root = this.read()): CaidoInstance {
    const key = canonicalUrl(url);
    return new CaidoInstance(key, root.instances?.[key]);
  }

  static clearCachedToken(url: string): void {
    const root = this.read();
    const key = canonicalUrl(url);
    if (!root.instances?.[key]) return;
    delete root.instances[key].cachedToken;
    this.write(root);
  }

  static activeInstance(root = this.read()): CaidoInstance {
    const url = canonicalUrl(
      process.env.CAIDO_URL || root.default || this.defaultUrl,
    );
    return this.instance(url, root);
  }

  private static readJson(path: string): any | undefined {
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return undefined;
    }
  }

  /** Normalize both the current shape and the old flat Claude-specific shape. */
  private static normalize(raw: any): CaidoSettingSchema {
    if (!raw || typeof raw !== "object") return { instances: {} };
    if (
      raw.instances &&
      typeof raw.instances === "object" &&
      !Array.isArray(raw.instances)
    ) {
      return { default: raw.default, instances: raw.instances };
    }

    const url = canonicalUrl(
      typeof raw.url === "string" ? raw.url : this.defaultUrl,
    );
    const instance: CaidoInstanceData = {};
    if (raw.pat) instance.pat = raw.pat;
    if (raw.proxy) instance.proxy = raw.proxy;
    if (raw.cachedToken?.accessToken) instance.cachedToken = raw.cachedToken;
    const hasAny = instance.pat || instance.proxy || instance.cachedToken;
    return {
      default: url,
      instances: hasAny ? { [url]: instance } : {},
    };
  }
}
