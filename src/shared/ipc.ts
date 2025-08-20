export const allowedChannels = [
    'app:notification',
    'task:stream',
] as const;

export type Channel = (typeof allowedChannels)[number];

export interface TaskStreamPayload {
    task: 'git-clone' | string;
    id?: string;
    stream: 'stdout' | 'stderr';
    text: string;
    final?: boolean;
}