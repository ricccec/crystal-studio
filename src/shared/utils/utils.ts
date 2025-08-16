import fs  from "node:fs/promises";

export async function isDirectory(path: string): Promise<boolean> {
    try {
        const st = await fs.stat(path);
        return st.isDirectory();
    } catch (err: any) {
        if (err && err.code === 'ENOENT') return false;
        throw err; // Unexpected error
    }
}