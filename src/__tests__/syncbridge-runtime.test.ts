import { describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const captured = vi.hoisted(() => ({ runtimeFor: undefined as undefined | ((manifest: unknown) => any) }));

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
  startPlugins: async (options: { runtimeFor: (manifest: unknown) => unknown }) => {
    captured.runtimeFor = options.runtimeFor as any;
    return { host: { capability: () => [] }, stop: async () => {} };
  },
}));

import { syncAllAcrossApps } from "../syncbridge.js";

describe("cross-app sync host runtimes", () => {
  it("hands the sync host a runtime built from each manifest", async () => {
    await syncAllAcrossApps(mkdtempSync(join(tmpdir(), "pu-rt-")));

    const runtime = captured.runtimeFor!(renamedManifest);

    expect(runtime.config.get("greeting")).toBe("hello");
  });
});
