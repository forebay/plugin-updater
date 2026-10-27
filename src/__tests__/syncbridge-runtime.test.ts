import { describe, it, expect, vi, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { startPlugins } from "@intisy/bayonet/host";

type RuntimeFor = Parameters<typeof startPlugins>[0]["runtimeFor"];

const isolated = vi.hoisted(() => {
  const { mkdtempSync: makeTempDir } = require("fs") as typeof import("fs");
  const { tmpdir: systemTempDir } = require("os") as typeof import("os");
  const { join: joinPath } = require("path") as typeof import("path");
  const home = makeTempDir(joinPath(systemTempDir(), "pu-rt-home-"));
  process.env.HUB_CONFIG_DIR = home;
  process.env.PLUGIN_UPDATER_APP = "opencode";
  return { home, captured: { runtimeFor: undefined as undefined | RuntimeFor } };
});

const renamedManifest = {
  id: "renamed-provider",
  api: 1,
  entry: "renamed.js",
  capabilities: ["cross-app-sync"],
  config: { name: "renamed", defaults: { greeting: "hello" } },
};

vi.mock("@intisy/bayonet/host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@intisy/bayonet/host")>()),
  readDeployedManifests: () => ({ loaded: [{ manifest: renamedManifest }], failed: [] }),
  startPlugins: async (options: { runtimeFor: RuntimeFor }) => {
    isolated.captured.runtimeFor = options.runtimeFor;
    const implementation = { sync: async () => ({}) };
    return {
      host: { capability: () => [{ pluginId: renamedManifest.id, implementation }] },
      stop: async () => {},
    };
  },
}));

import { syncAllAcrossApps } from "../syncbridge.js";

afterAll(() => {
  rmSync(isolated.home, { recursive: true, force: true });
});

describe("cross-app sync host runtimes", () => {
  it("hands the sync host a runtime built from each manifest", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "pu-rt-"));
    try {
      await syncAllAcrossApps(configDir);

      const runtime = isolated.captured.runtimeFor!(renamedManifest as Parameters<RuntimeFor>[0]);

      expect(runtime.config.get("greeting")).toBe("hello");
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });
});
