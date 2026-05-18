import path from 'path';

/**
 * Checks if a target path is safe (i.e., securely within a base directory)
 * @param basePath The allowed root directory
 * @param targetPath The path to check
 * @returns boolean True if safe, False if unsafe (e.g. attempting traversal)
 */
export function isSafePath(basePath: string, targetPath: string): boolean {
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget.startsWith(resolvedBase);
}

/**
 * Sanitizes a filename to remove dangerous characters
 * @param filename The filename to sanitize
 * @returns string Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9\.\-\_]/gi, '_');
}

/**
 * Resolves a target path and ensures it is within the base directory.
 * Throws an error if the path attempts traverse out of the base directory.
 * @param basePath The allowed root directory
 * @param targetPath The path to check (relative or absolute)
 * @returns string The resolved absolute safe path
 */
export function getSafePath(baseFile: string, targetPath: string): string {
    const resolvedBase = path.resolve(baseFile);
    const resolvedTarget = path.resolve(resolvedBase, targetPath);

    // Ensure the resolved target starts with the base directory AND
    // that it's either exactly the base directory or followed by a path separator.
    // This prevents /base/path matching /base/path-sibling
    if (!resolvedTarget.startsWith(resolvedBase) ||
        (resolvedTarget.length > resolvedBase.length && resolvedTarget[resolvedBase.length] !== path.sep)) {
        throw new Error('Access denied: Path traversal detected.');
    }

    return resolvedTarget;
}
