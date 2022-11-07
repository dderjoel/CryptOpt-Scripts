#!/usr/bin/env node
"use strict";
exports.__esModule = true;
var fs = require("fs");
var os = require("os");
var path = require("path");
var child_process_1 = require("child_process");
var _a = process.argv, _ = _a[0], _2 = _a[1], best_folder = _a[2], destination_fileame = _a[3];
var NO_COMPILER_SAMPLES = 3; // how many compiler samples for each asm-file there should be
var me = os.cpus()[0].model;
//helpers -getOptArchFromFile
function parseFile(filename) {
    return fs
        .readFileSync(filename)
        .toString()
        .split("\n")
        .filter(function (line) { return line.startsWith("; cpu ") || line.startsWith("\tGLOBAL"); })
        .reduce(function (res, line) {
        var _a, _b, _c, _d, _e, _f;
        res.symbol =
            (_c = (_b = (_a = line.match(/\tGLOBAL (?<symbol>.*)$/)) === null || _a === void 0 ? void 0 : _a.groups) === null || _b === void 0 ? void 0 : _b.symbol) !== null && _c !== void 0 ? _c : res.symbol;
        res.opton =
            (_f = (_e = (_d = line.match(/; cpu (?<opton>.*)$/)) === null || _d === void 0 ? void 0 : _d.groups) === null || _e === void 0 ? void 0 : _e.opton) !== null && _f !== void 0 ? _f : res.opton;
        return res;
    }, { opton: "", symbol: "" });
}
if (!best_folder) {
    console.error("\u001B[31mcall with ".concat(process.argv[0], " ").concat(process.argv[1], " path/to/bestfolder [path/to/destination_fileame.json]. Bestfolder contains the asm results files of all optimised curves. if destination_fileame.json is not given, will print to stdout \u001B[0m"));
    process.exit(1);
}
var COMPILER = ["gcc", "clang"];
var path_to_cycle_js = path.resolve("../");
var results = fs
    .readdirSync(best_folder)
    .filter(function (filename) { return filename.endsWith(".asm"); })
    .map(function (filename) { return path.join(best_folder, filename); })
    .reduce(function (acc, filename) {
    var _a = parseFile(filename), sym = _a.symbol, opton = _a.opton;
    if (!(sym in acc)) {
        acc[sym] = [];
    }
    // getCyclecount for filenames
    var median = Number((0, child_process_1.execSync)("".concat(path_to_cycle_js, " ").concat(filename, " ")).toString());
    acc[sym].push({
        filename: filename,
        opton: opton,
        median: median,
        runon: me
    });
    // CC's
    COMPILER.forEach(function (cc) {
        for (var i = 0; i < NO_COMPILER_SAMPLES; i++) {
            var median_1 = Number((0, child_process_1.execSync)("".concat(path_to_cycle_js, " ").concat(sym), {
                env: { CC: cc }
            }).toString());
            acc[sym].push({
                filename: "".concat(i, "NA"),
                opton: cc,
                median: median_1,
                runon: me
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
