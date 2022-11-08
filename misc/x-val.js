#!/usr/bin/env node
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
//////node, x-val.js ...
const [_, _2, best_folder, destination_fileame] = process.argv;
const NO_COMPILER_SAMPLES = 3; // how many compiler samples for each asm-file there should be
const me = os.cpus()[0].model;
// helpers
function parseFile(filename) {
    return fs
        .readFileSync(filename)
        .toString()
        .split("\n")
        .filter((line) => line.startsWith("; cpu ") || line.startsWith("\tGLOBAL"))
        .reduce((res, line) => {
        res.symbol =
            line.match(/\tGLOBAL (?<symbol>.*)$/)?.groups?.symbol ?? res.symbol;
        res.opton =
            line.match(/; cpu (?<opton>.*)$/)?.groups?.opton ?? res.opton;
        return res;
    }, { opton: "", symbol: "" });
}
if (!best_folder) {
    console.error(`\x1b[31mcall with ${process.argv[0]} ${process.argv[1]} path/to/bestfolder [path/to/destination_fileame.json]. Bestfolder contains the asm results files of all optimised curves. if destination_fileame.json is not given, will print to stdout \x1b[0m`);
    process.exit(1);
}
const COMPILER = ["gcc", "clang"];
const path_to_cycle_js = path.resolve("../../../dist/CountCycle.js");
const results = fs
    .readdirSync(best_folder)
    .filter((filename) => filename.endsWith(".asm"))
    .map((filename) => path.join(best_folder, filename))
    .reduce((acc, filename) => {
    const { symbol: sym, opton } = parseFile(filename);
    if (!(sym in acc)) {
        acc[sym] = [];
    }
    // // getCyclecount for filenames
    // const median = Number(
    //   execFileSync("node", [path_to_cycle_js, filename]).toString()
    // );
    // acc[sym].push({
    //   filename,
    //   opton,
    //   median,
    //   runon: me,
    // });
    // CC's
    COMPILER.forEach((cc) => {
        for (let i = 0; i < NO_COMPILER_SAMPLES; i++) {
            const median = Number(execFileSync("node", [path_to_cycle_js, sym], {
                env: { ...process.env, CC: cc },
            }).toString());
            acc[sym].push({
                filename: `${i}NA`,
                opton: cc,
                median,
                runon: me,
            });
        }
    });
    return acc;
}, {});
if (!destination_fileame || destination_fileame == "-") {
    console.log(results);
}
else {
    fs.writeFileSync(destination_fileame, JSON.stringify(results));
}
