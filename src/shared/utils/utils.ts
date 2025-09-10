import fs  from "node:fs/promises";
import path from "node:path";
import { constants as fsConstants } from 'node:fs'

export async function isDirectory(filePath: string): Promise<boolean> {
    try {
        const st = await fs.stat(filePath);
        return st.isDirectory();
    } catch (err: any) {
        if (err && err.code === 'ENOENT') return false;
        throw err; // Unexpected error
    }
}

/**
 * Returns true if `p` is an executable on the current platform.
 * - POSIX: checks X_OK via fs.access
 * - Windows: checks extension against PATHEXT
 * - macOS: accepts .app bundles (directory)
 */
export async function isExecutable(p: string): Promise<boolean> {
    const normalized = path.normalize(p);

    try {
        const st = await fs.stat(normalized);
        if (st.isDirectory()) {
            // macOS app bundle
            if (normalized.toLowerCase().endsWith('.app')) return true;
            return false;
        }
    } catch (e: any) {
        // Not found -> not executable. Re-throw unexpected errors.
        if (e && e.code === 'ENOENT') return false;
        throw e;
    }

    if (process.platform === 'win32') {
        const pathext = (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
            .split(';')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
        const ext = path.extname(normalized).toLowerCase();
        return pathext.includes(ext);
    }

    // POSIX-like: check execute permission
    try {
        await fs.access(normalized, fsConstants.X_OK);
        return true;
    } catch {
        return false;
    }
}