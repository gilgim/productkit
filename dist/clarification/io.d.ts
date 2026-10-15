/**
 * Writes via a temp file in the same directory, then rename() into place.
 * rename() is atomic on the same filesystem, so a crash mid-write never
 * leaves a half-written file at the target path — the target is either the
 * old content or the new content, never a partial one.
 */
export declare function atomicWriteFile(targetPath: string, contents: string, options: {
    overwrite: boolean;
}): Promise<void>;
/** Atomically creates a file without replacing an existing path (hard-link publish). */
export declare function atomicCreateFile(targetPath: string, contents: string): Promise<boolean>;
/** Writes a temporary file then replaces target only if its bytes still match the read snapshot. */
export declare function atomicReplaceIfUnchanged(targetPath: string, expectedText: string, contents: string): Promise<void>;
/** Next free `<prefix>-NNN` id in `dir`, starting at 001. */
export declare function nextSequentialId(dir: string, prefix: string): Promise<string>;
/** Highest existing `<prefix>-NNN` id in `dir`, or undefined if none exist. */
export declare function latestId(dir: string, prefix: string): Promise<string | undefined>;
