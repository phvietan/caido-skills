import { expect, test } from "bun:test";
import { pluginArguments } from "../lib/commands/automation";

test("plugin arguments preserve JSON values and legacy request IDs", () => {
  expect(pluginArguments("123")).toEqual(["123"]);
  expect(pluginArguments(undefined, '["a","123"]')).toEqual(["a", "123"]);
  expect(pluginArguments(undefined, "[]")).toEqual([]);
  expect(pluginArguments(undefined, '[{"enabled":true},3]')).toEqual([
    { enabled: true },
    3,
  ]);
  for (const json of ["{", "{}", "null", "123", '[null]', '[{"x":null}]', '[1e999]'])
    expect(() => pluginArguments(undefined, json)).toThrow();
  expect(() => pluginArguments("123", "[]")).toThrow();
  expect(() => pluginArguments()).toThrow();
});
