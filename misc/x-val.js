#!/usr/bin/env node
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
//////node, x-val.js ...
const [, , best_folder, destination_fileame] = process.argv;
const me = os.cpus()[0].model;
//helpers -getOptArchFromFile
function parseFile(filename) {
    return fs
        .readFileSync(filename)
        .toString()
        .split("\n")
        .filter((line) => line.startsWith("; cpu ") || line.startsWith("\tGLOBAL"))
        .reduce((res, line) => {
        res.symbol = line.match(/\tGLOBAL (?<symbol>.*)$/)?.groups?.symbol ?? res.symbol;
        res.opton = line.match(/; cpu (?<opton>.*)$/)?.groups?.opton ?? res.opton;
        return res;
    }, { opton: "", symbol: "" });
}
if (!best_folder) {
    console.error(`\x1b[31mcall with ${process.argv[0]} ${process.argv[1]} path/to/bestfolder [path/to/destination_fileame.json]. Bestfolder contains the asm results files of all optimised curves. if destination_fileame.json is not given, will print to stdout \x1b[0m`);
    process.exit(1);
}
const COMPILER = ["gcc", "clang"];
const path_to_cycle_js = path.resolve("../../../dist/CountCycle.js");
const isInvalidMeasurement = (x) => {
    return typeof x !== "number" || isNaN(x) || x <= 0;
};
const results = fs
    .readdirSync(best_folder)
    .filter((filename) => filename.endsWith(".asm"))
    .map((filename) => path.join(best_folder, filename))
    .reduce((acc, filename) => {
    const { symbol: sym, opton } = parseFile(filename);
    if (!(sym in acc)) {
        acc[sym] = [];
    }
    // getCyclecount for filenames and CCs
    COMPILER.forEach((cc) => {
        let medianAsm;
        let medianCheck;
        // Measure
        do {
            [medianAsm, medianCheck] = execFileSync("node", [path_to_cycle_js, filename], {
                env: { ...process.env, CC: cc },
            })
                .toString()
                .split(" ")
                .map((s) => Number(s));
        } while (isInvalidMeasurement(medianAsm) || isInvalidMeasurement(medianCheck));
        acc[sym].push({
            filename,
            opton,
            median: medianAsm,
            runon: me,
        });
        acc[sym].push({
            filename: `${cc}NA`,
            opton: cc,
            median: medianCheck,
            runon: me,
        });
    });
    return acc;
}, {});
if (!destination_fileame || destination_fileame == "-") {
    console.log(results);
}
else {
    fs.writeFileSync(destination_fileame, JSON.stringify(results));
}
