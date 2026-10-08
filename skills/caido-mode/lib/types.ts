/** Shared types for caido-mode CLI */
export type JsonValue =
  boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface OutputOpts {
  maxBodyLines: number;
  maxBodyChars: number;
  noRequest: boolean;
  headersOnly: boolean;
}

export const DEFAULT_OUTPUT_OPTS: OutputOpts = {
  maxBodyLines: 200,
  maxBodyChars: 5000,
  noRequest: false,
  headersOnly: false,
};
