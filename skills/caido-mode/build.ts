import { mkdirSync } from "node:fs";
import packageJson from "./package.json";

mkdirSync("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["./caido-client.ts"],
  compile: {
    outfile: "./dist/caido-client",
    autoloadDotenv: false,
  },
  define: {
    __CAIDO_CLIENT_VERSION__: JSON.stringify(packageJson.version),
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log(`Built caido-client v${packageJson.version}.`);
