// =====================
// 打順提案ロジック（純粋関数）
// =====================

const DEFAULT_WEIGHTS = {
    ops: 0.45,
    woba: 0.55
};

const DEFAULT_MIN_PA = 8;

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * OPS/wOBA 重みベースで打順候補を算出
 * @param {Array<Object>} starters
 * @param {Object<string, Object>} metricsByPlayerId
 * @param {Object} [options]
 * @param {Object} [options.weights] - { ops, woba }
 * @param {number} [options.minPlateAppearances=8] - 信頼度が100%になる目安PA
 * @returns {Object}
 */
export function buildRecommendedLineup(starters, metricsByPlayerId, options = {}) {
    const weights = {
        ...DEFAULT_WEIGHTS,
        ...(options.weights || {})
    };
    const minPA = Math.max(1, toFiniteNumber(options.minPlateAppearances, DEFAULT_MIN_PA));

    const source = Array.isArray(starters) ? starters : [];
    const battingRows = source
        .map((s) => ({ starter: s }))
        .filter(({ starter }) => starter?.playerId && starter?.order && starter.order <= 9)
        .map(({ starter: s }) => {
            const metrics = metricsByPlayerId?.[s.playerId] || {};
            const ops = toFiniteNumber(metrics.ops);
            const woba = toFiniteNumber(metrics.woba);
            const pa = Math.max(0, toFiniteNumber(metrics.pa));
            const reliability = Math.min(pa / minPA, 1);
            const weighted = (weights.ops * ops) + (weights.woba * woba);
            const score = weighted * (0.6 + reliability * 0.4);
            return {
                starter: s,
                playerId: s.playerId,
                currentOrder: s.order,
                score,
                ops,
                woba,
                pa
            };
        });

    const sorted = [...battingRows].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.woba !== a.woba) return b.woba - a.woba;
        if (b.ops !== a.ops) return b.ops - a.ops;
        return a.currentOrder - b.currentOrder;
    });

    const recommendedOrderByPlayer = new Map(
        sorted.map((row, idx) => [row.playerId, idx + 1])
    );

    const recommendedFirstNine = Array(9).fill(null).map((_, idx) => ({
        order: idx + 1,
        position: null,
        playerId: null
    }));

    sorted.forEach((row, idx) => {
        recommendedFirstNine[idx] = {
            ...row.starter,
            order: idx + 1
        };
    });

    const recommendedStarters = [
        ...recommendedFirstNine,
        ...source.slice(9).map((s, idx) => ({
            ...s,
            order: 10 + idx
        }))
    ];

    const comparison = battingRows
        .map(row => ({
            playerId: row.playerId,
            currentOrder: row.currentOrder,
            recommendedOrder: recommendedOrderByPlayer.get(row.playerId) || row.currentOrder,
            changed: (recommendedOrderByPlayer.get(row.playerId) || row.currentOrder) !== row.currentOrder,
            score: row.score,
            ops: row.ops,
            woba: row.woba,
            pa: row.pa
        }))
        .sort((a, b) => a.currentOrder - b.currentOrder);

    return {
        recommendedStarters,
        comparison,
        changedCount: comparison.filter(r => r.changed).length,
        targetCount: comparison.length
    };
}

