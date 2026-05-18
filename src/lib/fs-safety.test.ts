import { describe, it, expect } from 'vitest';
import path from 'path';
import { getSafePath } from './fs-safety';

describe('getSafePath', () => {
    // Create an absolute path to simulate the allowed root directory.
    // path.resolve ensures this is formatted correctly for the OS (Windows/Linux).
    const baseDir = path.resolve('test-library');

    it('should allow a simple filename within the base directory', () => {
        const result = getSafePath(baseDir, 'asset.json');
        expect(result).toBe(path.join(baseDir, 'asset.json'));
    });

    it('should allow nested directories within the base directory', () => {
        const result = getSafePath(baseDir, '3d/surface/wood.jpg');
        expect(result).toBe(path.join(baseDir, '3d', 'surface', 'wood.jpg'));
    });

    it('should resolve relative paths that stay inside the root', () => {
        // "subdir/../file.txt" -> "file.txt"
        const result = getSafePath(baseDir, path.join('subdir', '..', 'file.txt'));
        expect(result).toBe(path.join(baseDir, 'file.txt'));
    });

    it('should throw an error when trying to traverse up out of the root', () => {
        expect(() => getSafePath(baseDir, '../secret.txt'))
            .toThrow('Access denied: Path traversal detected.');
    });

    it('should throw an error for deep traversal to system root', () => {
        // Tries to go way up to root (e.g., /etc/passwd or C:\Windows)
        expect(() => getSafePath(baseDir, '../../../../../../etc/passwd'))
            .toThrow('Access denied: Path traversal detected.');
    });

    it('should throw an error if an absolute path points outside the root', () => {
        // Simulate an attacker providing a full absolute path to a sensitive file
        const outsidePath = path.resolve(baseDir, '..', 'outside.txt');
        expect(() => getSafePath(baseDir, outsidePath))
            .toThrow('Access denied: Path traversal detected.');
    });

    it('should prevent partial directory name matching attacks', () => {
        // If baseDir is ".../test-library", ensure we can't access ".../test-library-backup"
        // This tests the trailing slash logic in the security check.
        const folderName = path.basename(baseDir);
        const partialMatchPath = `../${folderName}-backup/secret.json`;

        expect(() => getSafePath(baseDir, partialMatchPath))
            .toThrow('Access denied: Path traversal detected.');
    });
});