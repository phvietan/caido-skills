import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createProgram } from "../caido-client";

test("every execution handler has a documented Commander command", () => {
  const source = readFileSync(
    new URL("../caido-client.ts", import.meta.url),
    "utf8",
  );
  const handlers = [...source.matchAll(/case "([^"]+)":/g)]
    .map((m) => m[1])
    .sort();
  expect(
    createProgram(() => {})
      .commands.map((c) => c.name())
      .sort(),
  ).toEqual(handlers);
});

for (const command of createProgram(() => {}).commands) {
  test(`${command.name()}: help and example are usable`, async () => {
    let output = "";
    let invocation: any;
    const program = createProgram((value) => {
      invocation = value;
    });
    for (const node of [program, ...program.commands])
      node.exitOverride().configureOutput({
        writeOut: (text) => {
          output += text;
        },
        writeErr: () => {},
      });
    try {
      await program.parseAsync([command.name(), "--help"], { from: "user" });
    } catch (error: any) {
      expect(error.code).toBe("commander.helpDisplayed");
    }
    expect(output).not.toContain("[args...]");
    expect(output).toContain("Example");
    for (const option of command.options)
      expect(option.description.length).toBeGreaterThan(0);
    const example = output.match(/  caido-client (.+)/)?.[1];
    expect(example).toBeDefined();
    // Examples deliberately use simple shell words and single/double quoting.
    const args = example!
      .match(/"[^"]*"|'[^']*'|\S+/g)!
      .map((word) => (/^['"]/.test(word) ? word.slice(1, -1) : word));
    await createProgram((value) => {
      invocation = value;
    })
      .exitOverride()
      .parseAsync(args, { from: "user" });
    expect(invocation.command).toBe(command.name());
    expect(invocation.args.length).toBe(command.registeredArguments.length);
  });
}

test("negative flags reach the execution handlers", async () => {
  let invocation: any;
  await createProgram((value) => {
    invocation = value;
  }).parseAsync(["edit-session", "Login", "--no-name-change", "--no-request"], {
    from: "user",
  });
  expect(invocation.values["no-name-change"]).toBe(true);
  expect(invocation.values["no-request"]).toBe(true);
  await createProgram((value) => {
    invocation = value;
  }).parseAsync(
    [
      "send-raw",
      "--host",
      "example.com",
      "--raw",
      "GET / HTTP/1.1",
      "--name",
      "Test",
      "--no-tls",
    ],
    { from: "user" },
  );
  expect(invocation.values["no-tls"]).toBe(true);
});

test("unrelated flags and extra positionals are rejected", async () => {
  for (const args of [
    ["health", "--body", "test"],
    ["health", "extra"],
  ]) {
    const program = createProgram(() => {})
      .exitOverride()
      .configureOutput({ writeErr: () => {} });
    for (const node of program.commands)
      node.exitOverride().configureOutput({ writeErr: () => {} });
    await expect(program.parseAsync(args, { from: "user" })).rejects.toThrow();
  }
});
