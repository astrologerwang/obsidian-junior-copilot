import esbuild from "esbuild";
import svgPlugin from "esbuild-plugin-svg";
import process from "process";
import wasmPlugin from "./wasmPlugin.mjs";
import { copyFileSync, readFileSync } from "fs";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
    ],
    format: "cjs",
    target: "es2020",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    plugins: [svgPlugin(), wasmPlugin],
    define: {
        global: "window",
        "process.env.NODE_ENV": prod ? '"production"' : '"development"',
    },
    minify: prod,
    outdir: "dist",
});

function distributeFiles() {
    const vaultLocation = readFileSync("D:\\vault_location.txt", "utf-8").trim();
    const pluginLocation = `${vaultLocation}\\.obsidian\\plugins\\copilot`;
    copyFileSync("dist/main.js", `${pluginLocation}\\main.js`);
    copyFileSync("dist/styles.css", `${pluginLocation}\\styles.css`);
    copyFileSync("dist/manifest.json", `${pluginLocation}\\manifest.json`);
}

if (prod) {
    await context.rebuild();
    copyFileSync("manifest.json", "dist/manifest.json");
    distributeFiles();
    process.exit(0);
} else {
    await context.watch();
}
