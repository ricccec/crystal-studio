import { z } from 'zod';

export const AppSettingsSchema = z.object({
    lastUsedPath: z.string().nullable().optional(),
    makeDir: z.string().nullable().optional(),
    rgbdsDir: z.string().nullable().optional(),
    cygwinDir: z.string().nullable().optional(),
    gccDir: z.string().nullable().optional(),
    bashDir: z.string().nullable().optional(),
    emulator: z.string().nullable().optional(),
    rom: z.string().nullable().optional(),
    repoUrl: z.string(),
    toolAliases: z.record(
        z.string(),
        z.record(
            z.string(),
            z.array(z.string())
        )
    ),
    make: z.object({
        numJobs: z.number(),
        target: z.string(),
    }),
});

export type AppSettingsValidated = z.infer<typeof AppSettingsSchema>;