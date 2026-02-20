#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';

const repoRoot = resolve(process.cwd());
const appJsPath = resolve(repoRoot, 'public/js/app.js');
const htmlPath = resolve(repoRoot, 'public/index.html');

const appCode = readFileSync(appJsPath, 'utf8');
const html = readFileSync(htmlPath, 'utf8');
const jsTemplateSources = globSync('public/js/**/*.js', { cwd: repoRoot })
    .map(path => ({ path, code: readFileSync(resolve(repoRoot, path), 'utf8') }));

const NON_APP_ONCLICK_FUNCTIONS = new Set([
    'switchTeam',
    'logout',
    'startMigration',
    'dismissMigration',
    'copyInviteFromLatestField'
]);

function getExportedNames(code) {
    const names = new Set();

    const declRegex = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
    for (const match of code.matchAll(declRegex)) {
        names.add(match[1]);
    }

    const blockMatch = code.match(/export\s*\{([\s\S]*?)\};/m);
    if (blockMatch) {
        const cleaned = blockMatch[1]
            .replace(/\/\/.*$/gm, '')
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);

        for (const item of cleaned) {
            if (item.includes(' as ')) {
                const [, alias] = item.split(/\s+as\s+/);
                if (alias) names.add(alias.trim());
            } else {
                names.add(item);
            }
        }
    }

    return names;
}

function getInlineHandlerFunctionNames(sourceCode) {
    const onclickRegex = /on(?:click|change)\s*=\s*"([^"]*)"/g;
    const fnNames = new Set();

    for (const m of sourceCode.matchAll(onclickRegex)) {
        const expr = m[1];
        const callRegex = /([A-Za-z_$][\w$]*)\s*\(/g;
        let fn;
        while ((fn = callRegex.exec(expr)) !== null) {
            const name = fn[1];
            const prevChar = expr[fn.index - 1];
            if (prevChar === '.') continue;
            if (name === 'if' || name === 'for' || name === 'while' || name === 'switch') continue;
            if (name === 'document' || name === 'window' || name === 'alert' || name === 'confirm' || name === 'prompt') continue;
            fnNames.add(name);
        }
    }

    return fnNames;
}

const appExports = getExportedNames(appCode);
const onclickFns = new Set([
    ...getInlineHandlerFunctionNames(html),
    ...jsTemplateSources.flatMap(({ code }) => [...getInlineHandlerFunctionNames(code)])
]);

const onclickExpectedFromApp = [...onclickFns]
    .filter(name => !NON_APP_ONCLICK_FUNCTIONS.has(name))
    .sort();

const missingFromAppExports = onclickExpectedFromApp.filter(name => !appExports.has(name));
const unusedAppExports = [...appExports].filter(name => !onclickFns.has(name)).sort();

if (missingFromAppExports.length) {
    console.error('❌ app.js の export から不足している onclick 関数があります:');
    for (const name of missingFromAppExports) console.error(` - ${name}`);
    process.exit(1);
}

console.log(`✅ onclick内の app.js 対象関数はすべて export 済みです (${onclickExpectedFromApp.length}件)`);
if (unusedAppExports.length) {
    console.log('ℹ️ onclick で未使用の app.js export 一覧:');
    for (const name of unusedAppExports) console.log(` - ${name}`);
}
