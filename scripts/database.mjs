import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { requireDirectUrl, assertExpectedTarget } from "./lib/connection.mjs";

const [command, ...args] = process.argv.slice(2);
const commands = {
  deploy: ["migrate", "deploy"],
  migrate: ["migrate", "dev"],
  seed: ["db", "seed"],
  studio: ["studio"],
};

try {
  if (!Object.hasOwn(commands, command))
    throw new Error(
      "Usage: node scripts/database.mjs deploy|migrate|seed|studio --target host:port/database [Prisma arguments]",
    );
  const index = args.indexOf("--target");
  const expected = index < 0 ? undefined : args.splice(index, 2)[1];
  const direct = requireDirectUrl(process.env.DATABASE_URL_UNPOOLED);
  assertExpectedTarget(direct, expected);
  const cli = fileURLToPath(
    new URL("../node_modules/prisma/build/index.js", import.meta.url),
  );
  const child = spawn(process.execPath, [cli, ...commands[command], ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: direct,
      DATABASE_URL_UNPOOLED: direct,
    },
  });
  child.on("error", () => {
    console.error("Could not launch Prisma CLI.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
