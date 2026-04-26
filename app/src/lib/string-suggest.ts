/** Levenshtein distance for fuzzy matching (e.g. command palette suggestions). */
export function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

export function suggestSimilarTitles(query: string, titles: readonly string[], maxDist = 2, limit = 4): string[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const scored = titles
        .map((t) => ({ t, d: levenshtein(q, t.toLowerCase()) }))
        .filter(({ d }) => d > 0 && d <= maxDist)
        .sort((a, b) => a.d - b.d)
        .slice(0, limit)
        .map(({ t }) => t);
    return scored;
}
