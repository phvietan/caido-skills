import { mkdirSync } from "node:fs";

const targets = [
  ["bun-darwin-arm64", "caido-client-macos-arm64"],
  ["bun-darwin-x64", "caido-client-macos-x64"],
  ["bun-linux-x64-baseline", "caido-client-linux-x64"],
  ["bun-linux-arm64", "caido-client-linux-arm64"],
  ["bun-windows-x64-baseline", "caido-client-windows-x64.exe"],
] as const;

mkdirSync("dist", { recursive: true });

for (const [target, filename] of targets) {
  console.log(`Building ${filename}...`);
  const result = await Bun.build({
    entrypoints: ["./caido-client.ts"],
    compile: {
      target,
      outfile: `./dist/${filename}`,
      autoloadDotenv: false,
    },
    minify: true,
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
}

console.log(`Built ${targets.length} standalone executables in dist/.`);
