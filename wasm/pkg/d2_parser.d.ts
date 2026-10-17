/* tslint:disable */
/* eslint-disable */

/**
 * Parse a `.d2i` shared stash into JSON.
 */
export function parseD2i(bytes: Uint8Array): string;

/**
 * Parse a `.d2s` character save into JSON.
 */
export function parseD2s(bytes: Uint8Array): string;

/**
 * Write a `.d2i` shared stash from JSON produced by `parseD2i` (possibly edited).
 */
export function writeD2i(json: string): Uint8Array;

/**
 * Write a `.d2s` character save from JSON produced by `parseD2s` (possibly edited).
 */
export function writeD2s(json: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly parseD2i: (a: number, b: number) => [number, number, number, number];
    readonly parseD2s: (a: number, b: number) => [number, number, number, number];
    readonly writeD2i: (a: number, b: number) => [number, number, number, number];
    readonly writeD2s: (a: number, b: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
