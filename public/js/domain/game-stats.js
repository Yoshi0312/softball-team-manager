// =====================
// 集計API（純粋関数）
// DOM操作なし、グローバルstate参照なし
// 試合・選手・チームの集計ロジックを一箇所に集約
// =====================
import { BATTING_RESULTS, GAME_TYPES, WOBA_WEIGHTS } from '../constants.js';
import { getGameType, resolveGameType } from './game-utils.js';

/**
 * 試合配列をフィルタリング
 * 年度・種別の条件分岐を一箇所に集約する
 *
 * @param {Array<Object>} games - 試合データ配列
 * @param {Object} [options]
 * @param {number} [options.year] - 対象年度（省略時: フィルタなし）
 * @param {string} [options.type='all'] - 試合種別（'all'で全種別）
 * @returns {Array<Object>} フィルタ済み試合配列
 */
export function filterGames(games, options = {}) {
    const { year, type = 'all' } = options;
    return games.filter(g => {
        if (year !== undefined) {
            const gameYear = new Date(g.date).getFullYear();
            if (gameYear !== year) return false;
        }
        if (type !== 'all' && resolveGameType(g) !== type) return false;
        return true;
    });
}

/**
 * 特定選手の打撃成績を集計
 *
 * @param {Array<Object>} games - 試合データ配列
 * @param {string} playerId - 対象選手ID
 * @param {Object} [options] - フィルタ条件（filterGamesと同形式）
 * @param {number} [options.year] - 対象年度
 * @param {string} [options.type='all'] - 試合種別
 * @returns {Object} 集計結果
 */
export function calculatePlayerStats(games, playerId, options = {}) {
    // optionsが指定されていればfilterGamesを適用
    const filtered = (options.year !== undefined || (options.type && options.type !== 'all'))
        ? filterGames(games, options)
        : games;

    // playerId に関連するデータがある試合のみ抽出
    const relevantGames = filtered.filter(g =>
        g.playerStats && g.playerStats[playerId]
    );

    let stats = {
        games: 0,
        atBats: 0,
        hits: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        rbi: 0,
        walks: 0,
        hitByPitch: 0,
        strikeouts: 0,
        sacrifices: 0,
        sacrificeFlies: 0,
        totalBases: 0
    };

    relevantGames.forEach(game => {
        const ps = game.playerStats[playerId];
        if (!ps || !ps.atBats) return;

        const validAtBats = ps.atBats.filter(ab => ab);
        if (validAtBats.length === 0) return;

        stats.games++;
        stats.rbi += ps.rbi || 0;

        validAtBats.forEach(result => {
            const def = BATTING_RESULTS[result];
            if (!def) return;

            if (def.isAtBat) stats.atBats++;
            if (def.isHit) stats.hits++;
            stats.totalBases += def.totalBases;

            switch (result) {
                case 'single': stats.singles++; break;
                case 'double': stats.doubles++; break;
                case 'triple': stats.triples++; break;
                case 'homerun': stats.homeRuns++; break;
                case 'walk': stats.walks++; break;
                case 'hitByPitch': stats.hitByPitch++; break;
                case 'strikeout': stats.strikeouts++; break;
                case 'sacrifice': stats.sacrifices++; break;
                case 'sacrificeFly': stats.sacrificeFlies++; break;
            }
        });
    });

    // 基本指標の計算
    stats.avg = stats.atBats > 0 ? stats.hits / stats.atBats : 0;
    stats.slg = stats.atBats > 0 ? stats.totalBases / stats.atBats : 0;

    const obpDenom = stats.atBats + stats.walks + stats.hitByPitch + stats.sacrificeFlies;
    stats.obp = obpDenom > 0 ? (stats.hits + stats.walks + stats.hitByPitch) / obpDenom : 0;

    stats.ops = stats.obp + stats.slg;

    // 打席数（PA = 打数 + 四球 + 死球 + 犠飛 + 犠打）
    stats.pa = stats.atBats + stats.walks + stats.hitByPitch + stats.sacrificeFlies + stats.sacrifices;

    // wOBA（重み付け出塁率）
    const wobaDenom = stats.atBats + stats.walks + stats.hitByPitch + stats.sacrificeFlies;
    if (wobaDenom > 0) {
        stats.woba = (
            WOBA_WEIGHTS.bb * stats.walks +
            WOBA_WEIGHTS.hbp * stats.hitByPitch +
            WOBA_WEIGHTS.single * stats.singles +
            WOBA_WEIGHTS.double * stats.doubles +
            WOBA_WEIGHTS.triple * stats.triples +
            WOBA_WEIGHTS.homerun * stats.homeRuns
        ) / wobaDenom;
    } else {
        stats.woba = 0;
    }

    // ISO（純粋長打力 = 長打率 - 打率）
    stats.iso = stats.slg - stats.avg;

    // BABIP（インプレー打率）= (安打 - 本塁打) / (打数 - 三振 - 本塁打 + 犠飛)
    const babipDenom = stats.atBats - stats.strikeouts - stats.homeRuns + stats.sacrificeFlies;
    stats.babip = babipDenom > 0 ? (stats.hits - stats.homeRuns) / babipDenom : 0;

    // K%（三振率）= 三振 / 打席数
    stats.kRate = stats.pa > 0 ? stats.strikeouts / stats.pa : 0;

    // BB%（四球率）= 四球 / 打席数
    stats.bbRate = stats.pa > 0 ? stats.walks / stats.pa : 0;

    return stats;
}

/**
 * チーム成績サマリを計算（種別ごとの勝敗・得失点）
 *
 * @param {Array<Object>} games - 試合データ配列
 * @param {Object} [options]
 * @param {number} [options.year] - 対象年度
 * @param {string} [options.type='all'] - 試合種別（'all'で全種別、特定値でその種別のみ）
 * @returns {Array<Object>} 種別ごとのサマリ配列
 *   [{ type, label, count, wins, losses, draws, scored, conceded, diff, winRate }]
 */
export function calculateTeamSummary(games, options = {}) {
    const filtered = options.year !== undefined
        ? filterGames(games, { year: options.year })
        : games;

    // type指定があればその種別のみ、なければ全種別を返す
    const types = (options.type && options.type !== 'all')
        ? [options.type]
        : Object.keys(GAME_TYPES);

    return types.map(type => {
        const typeGames = filtered.filter(g => resolveGameType(g) === type);
        let wins = 0, losses = 0, draws = 0, scored = 0, conceded = 0;

        typeGames.forEach(g => {
            const our = g.ourScore || 0;
            const opp = g.opponentScore || 0;
            scored += our;
            conceded += opp;
            if (our > opp) wins++;
            else if (our < opp) losses++;
            else draws++;
        });

        const count = typeGames.length;
        const winRate = count > 0 ? ((wins + 0.5 * draws) / count) : null;
        return {
            type,
            label: GAME_TYPES[type].label,
            count,
            wins, losses, draws,
            scored, conceded,
            diff: scored - conceded,
            winRate
        };
    });
}

/**
 * 利用可能な年度一覧を取得
 * @param {Array<Object>} games - 試合データ配列
 * @returns {Array<number>} 降順ソート済みの年度配列
 */
export function getAvailableYears(games) {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    games.forEach(g => {
        if (g.date) {
            const y = new Date(g.date).getFullYear();
            if (!isNaN(y)) years.add(y);
        }
    });
    return Array.from(years).sort((a, b) => b - a);
}
