import packageJson from "../package.json";

declare const __CAIDO_CLIENT_VERSION__: string | undefined;

export const CAIDO_CLIENT_VERSION =
  typeof __CAIDO_CLIENT_VERSION__ === "undefined"
    ? packageJson.version
    : __CAIDO_CLIENT_VERSION__;
