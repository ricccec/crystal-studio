export type ProcessResult<T = string> =
    | { status: 'canceled' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: string };