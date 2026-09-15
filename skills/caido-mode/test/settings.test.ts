import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CaidoGlobalSettings } from "../lib/settings.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  delete process.env.CAIDO_SETTINGS_PATH;
  delete process.env.CAIDO_URL;
  delete process.env.CAIDO_PAT;
  delete process.env.CAIDO_PROXY;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function useTemporarySettings(): string {
  const directory = mkdtempSync(join(tmpdir(), "caido-client-settings-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "nested", "settings.json");
  process.env.CAIDO_SETTINGS_PATH = path;
  return path;
}

test("stores URL-keyed settings in the application-owned file", () => {
  const path = useTemporarySettings();

  CaidoGlobalSettings.instance("HTTP://LOCALHOST:8080/").update(
    { pat: "secret" },
    true,
  );
  CaidoGlobalSettings.instance("http://localhost:8081").update({
    proxy: "http://proxy",
  });

  assert.equal(CaidoGlobalSettings.path, path);
  assert.deepEqual(CaidoGlobalSettings.read(), {
    default: "http://localhost:8080",
    instances: {
      "http://localhost:8080": { pat: "secret" },
      "http://localhost:8081": { proxy: "http://proxy" },
    },
  });
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.doesNotMatch(readFileSync(path, "utf-8"), /"caido"\s*:/);
});

test("uses the conventional caido-client settings directory by default", () => {
  delete process.env.CAIDO_SETTINGS_PATH;
  assert.equal(
    CaidoGlobalSettings.path,
    join(CaidoGlobalSettings.directory, "settings.json"),
  );
  assert.match(
    CaidoGlobalSettings.path,
    /\.config\/caido-client\/settings\.json$/,
  );
});

test("resolves auth and proxy through the settings class", () => {
  useTemporarySettings();
  CaidoGlobalSettings.instance("http://localhost:8081").update(
    { pat: "stored-pat", proxy: "http://stored-proxy" },
    true,
  );
  const instance = CaidoGlobalSettings.activeInstance();

  assert.deepEqual(instance.loadConfig(), {
    url: "http://localhost:8081",
    pat: "stored-pat",
    authMode: "pat",
  });
  assert.equal(instance.proxy(), "http://stored-proxy");

  process.env.CAIDO_URL = "HTTP://LOCALHOST:8081/";
  process.env.CAIDO_PAT = "environment-pat";
  process.env.CAIDO_PROXY = "http://environment-proxy";
  const environmentInstance = CaidoGlobalSettings.activeInstance();
  assert.deepEqual(environmentInstance.loadConfig(), {
    url: "http://localhost:8081",
    pat: "environment-pat",
    authMode: "pat",
  });
  assert.equal(environmentInstance.proxy(), "http://environment-proxy");
});
