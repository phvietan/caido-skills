/** Shared types for caido-mode CLI */

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
