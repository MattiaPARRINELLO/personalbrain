/**
 * Shared mutable in-memory file system for storage tests.
 * Imported by both vi.mock factory and test code so they share
 * the exact same Map reference (module system caches the singleton).
 *
 * NOTE: This module MUST NOT import anything from the project
 * (no ../storage, ../types, etc.) to avoid circular deps.
 */
export const fsStore = new Map<string, string>();
