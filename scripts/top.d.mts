export function topK<T>(items: Iterable<T>, value: (item: T) => number | null | undefined, n: number): T[];
