#!/usr/bin/env ts-node

/**
 *
 *
 * Will write the res-compact  table to fd=1
 * Will write the res-avg      table to fd=3
 *
 *
 * Call with 1>./path/to/rescompact.tex
 * Call with 3>./path/to/res-avg.tex
 * eg: ./x-val2tex.ts  /mnt/pil/x-val >./full.tex 3>./avg.tex; then pdflatex  xval
 *
 * or to test
 * 3>&1
 *
 *
 *
 *
 */

import fs from "fs";
import { resolve } from "path";
import { mapValues } from "lodash";
import * as Stat from "simple-statistics";

type savings = number[];
type method_t = "mul" | "square";
type cc = "GCC" | "Clang";
type perCompilerSavings = { [c in cc]: savings };
type fSavings = { [m in method_t]: perCompilerSavings };

// this is what the files look like
// symbol is like "fiat_curve25519_carry_mul"
type CompareResult = {
  [symbol: string]: Array<{
    filename: string; // to distinguish solutions
    opton: string;
    median: number;
    runon: string; //"AMD Ryzen Threadripper..."
  }>;
};

const MS: readonly method_t[] = ["mul", "square"];
const CCs: readonly cc[] = ["Clang", "GCC"];

const compilerTableData: {
  [curve: string]: fSavings;
} = {};

const NA = "N/A";

let [, , folder] = process.argv;
if (!folder) {
  folder = "/mnt/pil/x-val/";
}

const cpu_simplename: { [key: string]: string } = {
  "AMD Ryzen Threadripper 1900X 8-Core Processor": "1900X",
  "AMD Ryzen 7 5800X 8-Core Processor": "5800X",
  "AMD Ryzen 9 5950X 16-Core Processor": "5950X",
  "AMD Ryzen 9 7950X 16-Core Processor": "7950X",
  "Intel(R) Core(TM) i7-6770HQ CPU @ 2.60GHz": "i7 6G",
  "Intel(R) Core(TM) i7-10710U CPU @ 1.10GHz": "i7 10G",
  "Intel(R) Core(TM) i9-10900K CPU @ 3.70GHz": "i9 10G",
  "11th Gen Intel(R) Core(TM) i7-11700KF @ 3.60GHz": "i7 11G",
  "12th Gen Intel(R) Core(TM) i9-12900KF": "i9 12G",
  "13th Gen Intel(R) Core(TM) i9-13900KF": "i9 13G",
};

const curveNameMapping: { [k: string]: string } = {
  // bls12_381_p: "BLS12-381 q",
  // bls12_381_q: "BLS12-381 p",
  p448_solinas: "Curve448",
  p224: "P-224",
  p256: "P-256",
  p384: "P-384",
  p434: "SIKEp434",
  p521: "P-521",
  curve25519: "Curve25519",
  curve25519_solinas: "Curve25519-Solinas",
  poly1305: "Poly1305",
  secp256k1_montgomery: "secp256k1",
  secp256k1_dettman: "secp256k1-Dettman",
};

const GM = "G.M.";
const cpuorder = [
  "1900X",
  "5800X",
  "5950X",
  "7950X",
  "i7 6G",
  "i7 10G",
  "i9 10G",
  "i7 11G",
  "i9 12G",
  "i9 13G",
];

const compilerMap: { [k: string]: cc } = {
  gcc: "GCC",
  clang: "Clang",
};

const curveToCaption = (curve: string): string => {
  if (curve in curveNameMapping) {
    return curveNameMapping[curve];
  }
  const c = symbol2cm(curve).curve;
  if (c in curveNameMapping) {
    return curveNameMapping[c];
  }
  return c;
};

// should contain all the implementations with all medians while processing. Then at the end, one can calculate GM's on all of them to find the candidate for merging into a lib.
const champs: {
  [func: string]: {
    [name: string]: number[];
  };
} = {};

const is_compiler = (opton: string): opton is cc => /GCC|Clang/.test(opton);

// create CompareResultmap from filenames
const bySymbol = fs
  .readdirSync(folder)
  .filter((f) => f.endsWith(".json"))
  .map((file) => fs.readFileSync(resolve(folder, file)).toString())
  .map((content) => JSON.parse(content) as CompareResult)
  .reduce(
    (acc, compareResult) => {
      Object.entries(compareResult)
        .filter(([symbol]) => {
          try {
            return symbol2cm(symbol).curve in curveNameMapping;
          } catch (e) {
            console.error("not using " + symbol);
            return false;
          }
        })
        .forEach(([symbol, counts]) => {
          if (!(symbol in acc)) {
            acc[symbol] = {};
          }
          if (!(symbol in champs)) {
            champs[symbol] = {};
          }
          counts.forEach(({ opton, median, filename, runon }) => {
            if (opton in compilerMap) {
              // assign different name to opton gcc-11 -> gcc, etc
              opton = compilerMap[opton];
            }
            if (opton in cpu_simplename) {
              opton = cpu_simplename[opton];
            }
            if (!(opton in acc[symbol])) {
              acc[symbol][opton] = {};
            }
            if (!(filename in acc[symbol][opton])) {
              acc[symbol][opton][filename] = [];
            }
            if (!(filename in champs[symbol])) {
              champs[symbol][filename] = [];
            }
            if (median) {
              // fill the opt on (i.e. one asm-solution)
              acc[symbol][opton][filename].push({
                ranOn: cpu_simplename[runon],
                cycles: median,
              });
              champs[symbol][filename].push(median);
            } else {
              console.warn(`why is median ${median} falsy?`);
            }
          });
        });
      return acc;
    },
    {} as {
      [symbol: string]: {
        [optOn: string]: {
          // cc or simpl.str
          [filename: string]: {
            // filename to uniquely identify the solutions.
            ranOn: string; // simpl. str
            cycles: number;
          }[];
        };
      };
    },
  );

const ft = `\\fontsize{5}{7}\\selectfont`;
const cf = "\\rule{-.2em}{0em}"; // makes the cell smaller in width
console.log(`\\renewcommand{\\arraystretch}{0.6}`);
console.log(`\\begin{table*}\\centering`);
console.log(`\\caption{ Optimization results. We show the relative improvements in \\% for the multiplication (top) and squaring (bottom) operations; time savings are marked in blue. 
First, to observe hardware-specific optimization, the ${cpuorder.length}-by-${cpuorder.length} matrix shows the performance the optimized operation that have been optimized on one machine and then run on another. 
The subsequent two rows (Clang/GCC) then show the time savings of our optimized operations over off-the-shelf-compilers.
Lastly, \`\`Final'' shows the time savings of our best-performing implementation over the best-performing compiler-generated version.
}
\\label{f:results}
`);

const scale = 1;
function ratioAdjust(ratio: number): number {
  return ratio / scale;
}
const writeTableheader = (symbol: string) => symbol.toLowerCase().includes("mul");
const writeTablefooter = (symbol: string) => symbol.toLowerCase().includes("square");

const createCell = (ratio: number, tiny = true): string => {
  // fully saturated
  const colMin = 0.9;
  const colMax = 1 / colMin;
  const maxSat = 100; // full saturation for any color; minSat=0 omitted

  let cellFactor = 0;
  let cellcolor = "red";
  const col100 = "lightgray";
  const colbad = "orange";
  const colgood = "blue";
  const even = 1;
  if (isNaN(ratio)) {
    ratio = -1;
  }

  // fully saturated cases
  if (ratio < even) {
    cellcolor = colbad;
    cellFactor = maxSat;
  }
  if (ratio > even) {
    cellcolor = colgood;
    cellFactor = maxSat;
  }
  if (ratio == even) {
    cellcolor = col100;
    cellFactor = maxSat;
  }

  // linear mapping.
  if (ratio > colMin && ratio < colMax) {
    const x = ratio;
    // y = mx+b;
    let m: number;
    // y=0 for x=even, cause for x=even we want the lightest color
    // => 0= m*even+b => b=-m*even
    if (x < even) {
      m = maxSat / (colMin - even);
    } else {
      m = maxSat / (colMax - even);
    }
    const b = -m * even;
    const y = m * x + b;
    cellFactor = y;
    // cellcolor = ratio < 1 ? "red" : ratio > 1 ? "darkgreen" : "lightgray";
  }
  let color = `\\cellcolor{${cellcolor.padStart(9)}!${cellFactor.toFixed(0).padEnd(3)}}`;
  color += `\\color{${cellFactor > 50 && cellcolor !== col100 && cellcolor == colgood ? "white" : "black"}}`;
  const text = ratio == even ? "    " : ratio.toFixed(2);

  return tiny ? `${ft}${cf}${color}$${text}$${cf}` : `${color}{$${text}$}`;
};

fs.writeFileSync("/tmp/bySymbol.json", JSON.stringify(bySymbol, undefined, 2));
Object.entries(bySymbol)
  .sort((e1, e2) => e1[0].localeCompare(e2[0])) // to have an alphabetical order of symbols (curves)
  .forEach(([symbol, optOnStructure]) => {
    // TABLE HEADER STUFF

    // COLUMN DEFINITION CONTENT
    const setOfMachines = Object.values(optOnStructure)
      .flatMap((o) => Object.values(o))
      .flatMap((runs) => runs)
      .map(({ ranOn }) => ranOn)
      .reduce((acc, machine) => acc.add(machine), new Set<string>());

    const machineLen = setOfMachines.size;
    const numberOfColumns = machineLen + 1 /*opton*/ + 1; /*GM*/

    if (writeTableheader(symbol)) {
      // COLUMN DEFINITION
      console.log(`\t\\setlength{\\tabcolsep}{2.7px}`);
      console.log(
        `\t\\begin{tabular}{ @{}r ${Array(numberOfColumns - 1 /*no opton*/)
          .fill("c")
          .join("")}}`,
      );
      // console.log(`\t\t\\addlinespace[-1em]`); // to squeeze into pageheight
      console.log(`\t\t\\multicolumn{${numberOfColumns}}{c}{\\small ${curveToCaption(symbol)}}\\\\`);
      console.log("\t\t\\addlinespace[-.1em]\n");
      console.log(`\t\t\\cmidrule{1-${numberOfColumns}}`);

      const header0 = `\t\t${ft} run~on & ${cpuorder
        .concat(GM)
        .map((m) => `${ft}\\rotatebox{90}{${m}}`)
        .join(" & ")}\\\\`;
      const header1 = `\t\t${ft} opt~on ${Array(numberOfColumns).fill(" ").join("&")}\\\\`;
      console.log(header0);
      console.log("\t\t\\addlinespace[-.1em]\n");
      console.log(header1);
    } else {
      //distance between mul/sq
      console.log(`\t\\addlinespace[+.4em]`);
    }

    const bestAsmPerMachine: number[] = []; // indexed by i in cpuorder to ensure to be in the same order as the cols
    const bestCcPerMachine: number[] = []; // indexed by i in cpuorder to ensure to be in the same order as the cols

    // ROWS. one for EACH OPTON_STRUCTURE
    cpuorder.concat(...CCs).forEach((y_opton) => {
      // have a divider before compilers
      if (CCs.indexOf(y_opton as cc) == 0) {
        console.log(`\t\t\\addlinespace[.1em]\n`);
      }

      if (!(y_opton in optOnStructure)) {
        console.warn(
          `${y_opton} should be present in ${symbol}'s optOnStructure 1 (means there is no assembly file from ${y_opton} implementing ${symbol})`,
        );
        return `${ft}${cf}${NA}`;
      }
      const allOptimistionRunsForCurrentRow = Object.values(optOnStructure[y_opton]).flatMap((runs) => runs);

      // first col
      const firstCol = ` ${y_opton}`;

      const restColRatios = cpuorder.map((col, i) => {
        // col is a cpu like "1900X" on which we run on

        // if 'col' is not in optOnStructure, we  don't have reference
        // that happens if there was no optimisation for current `symbol` from machine `col`
        let reference = [] as number[];
        if (!(col in optOnStructure)) {
          console.warn(
            `${y_opton} should be present in ${symbol}'s optOnStructure 2 (means there is no assembly file from ${y_opton} implementing ${symbol})`,
          );
          return `${ft}${cf}${NA}`;
        }
        // the reference is all those implementations which are optimised and run on the current col
        reference = Object.values(optOnStructure[col])
          .flatMap((runs) => runs)
          .filter(({ ranOn }) => ranOn == col)
          .map(({ cycles }) => cycles);

        // whereas the cycles for the current cell, is the optimized by row by run on column
        const cyclesforCurrentCell = allOptimistionRunsForCurrentRow
          .filter(({ ranOn }) => ranOn === col)
          .map(({ cycles }) => cycles);

        if (cyclesforCurrentCell.length == 0 || reference.length == 0) {
          return `${ft}${cf}${NA}`;
        }

        const cycles_R = Stat.mean(reference);
        const cycles_C = Stat.mean(cyclesforCurrentCell);

        let ratio = cycles_C / cycles_R;

        ratio = ratioAdjust(ratio);
        // const pVal = Stat.tTestTwoSample(reference, cyclesforCurrentCell)!.toFixed(4);
        if (is_compiler(y_opton)) {
          addToCompilerTableData(symbol, y_opton, ratio);
          if (!bestCcPerMachine[i]) {
            bestCcPerMachine[i] = Infinity;
          }
          bestCcPerMachine[i] = Math.min(cycles_C, bestCcPerMachine[i]);
        } else {
          if (!bestAsmPerMachine[i]) {
            bestAsmPerMachine[i] = Infinity;
          }
          bestAsmPerMachine[i] = Math.min(cycles_C, bestAsmPerMachine[i]);
        }
        return ratio;
      });

      // getting the gm for the row
      let gm: number | string;
      try {
        gm = Stat.geometricMean(restColRatios.filter((r) => typeof r === "number") as number[]);
      } catch (e) {
        gm = `${ft}${cf}${NA}`;
        console.warn(`cannot calculate ${symbol}-${y_opton} mean`);
      }

      // res
      const restCols = restColRatios.concat(gm).map((r) => (typeof r === "number" ? createCell(r) : r));

      console.log(`\t\t${ft}${firstCol.padEnd(7)} & ${restCols.join(" & ")} \\\\`);
    });
    console.log(`\t\t\\addlinespace[.1em]`);

    // final row
    const finalRatios = bestAsmPerMachine.map((cycle, i) => bestCcPerMachine[i] / cycle).map(ratioAdjust);
    let finalGm: number | string;
    try {
      finalGm = Stat.geometricMean(finalRatios.filter((r) => typeof r === "number") as number[]);
      finalGm = createCell(finalGm);
    } catch (e) {
      finalGm = `${ft}${cf}${NA}`;
      console.warn(`cannot calculate ${symbol}-Final mean`);
    }

    console.log(
      // `\\midrule
      `\t\t${ft} Final  & ${finalRatios.map((r) => createCell(r)).join(" & ")} & ${finalGm} \\\\
      `,
    );

    if (writeTablefooter(symbol)) {
      console.log(`\t\t\\addlinespace[1em]\n\t\\end{tabular}`);
    }
    // if (idx % 2 == 1) {
    //   console.log(`\\cleardoublepage`);
    // }
  });

console.log(`\\end{table*}`);

function addToCompilerTableData(symbol: string, compiler: cc, ratio: number): void {
  const { curve, method } = symbol2cm(symbol);
  if (!(curve in compilerTableData))
    compilerTableData[curve] = {
      mul: { GCC: [], Clang: [] },
      square: { GCC: [], Clang: [] },
    };

  compilerTableData[curve][method][compiler].push(ratio);
}
function symbol2cm(sy: string): { curve: string; method: method_t } {
  let curve = "";
  let method: method_t | undefined = undefined;

  const sym = sy.replaceAll("fiat_", "").replaceAll("_carry", "");
  MS.forEach((m) => {
    const suffix = `_${m}`;
    if (sym.endsWith(suffix)) {
      method = m;
      curve = sym.split(suffix)[0];
    }
  });
  if (method) return { curve, method };
  throw new Error("'" + sym + "' is in the wrong format");
}

const stream = fs.createWriteStream("", { fd: 3 });
stream.write(`\\begin{wraptable}{r}{\\textwidth}\n`);
stream.write(`\t\\small\n`);
stream.write(`\t\\begin{center}\n`);
stream.write(`\t\\caption{Geometric means of \\cryptopt vs. off-the-shelf compilers.}\n`);
stream.write(`\t\\label{tab:res-avg}\n`);
stream.write(`\t\t\\begin{tabular}{@{}lccccc}\n`);
stream.write(`\t\t\\toprule\n`);
stream.write(`\t\t\t      & \\multicolumn{2}{c}{Multiply} & & \\multicolumn{2}{c}{Square}\\\\\n`);
stream.write(`\t\t\t                \\cmidrule{2-3}                  \\cmidrule{5-6} \n`);
stream.write(`\t\t\tCurve & ${MS.flatMap((_) => CCs.join(" & ")).join(" & & ")} \\\\\n`);
stream.write(`\t\t\\midrule\n`);

// stream.write(`\\multicolumn{8}{c}{\\small ${curveToCaption(curve)}}\\\\\n`);
const GMs = [1, 1];
let GMlen = 0;

Object.entries(compilerTableData).map(([curve, ratios]) => {
  stream.write(`\t\t\t${curveToCaption(curve)} `);
  MS.map((f) => {
    GMlen += 1;
    CCs.map((cc, i) => {
      const mean = Stat.geometricMean(ratios[f][cc]);
      GMs[i] *= mean;
      stream.write(` & ${createCell(mean, false /*not tiny*/)}`);
    });
    if (f == "mul") stream.write(` & `);
  });

  stream.write(`\\\\\n`);
});
stream.write(`\t\t\\bottomrule\n`);
stream.write(`\t\t\\end{tabular}\n`);
stream.write(`\t\\end{center}\n`);
stream.write(`\\end{wraptable}\n`);
CCs.forEach((cc, i) => {
  console.error(`GMLen:${GMlen}\nGM speedup for ${cc.padEnd(6)}  :${Math.pow(GMs[i], 1 / GMlen).toFixed(4)}`);
});

console.error(
  `\n~~~~~~~~~~~Geometic Means of cycles of each impl over ${cpuorder.length} archs (to copy into your lib) ~~~~~~~~~~~~\n`,
);
Object.entries(champs).forEach(([func, champ]) => {
  console.error(`~~~~~~~~~~~~~~~~~~~~~${func}~~~~~~~~~~~~~~~~~~~~~`);

  const sortedBest = Object.entries(mapValues(champ, (cycles) => Stat.geometricMean(cycles)))
    .sort(([, c1], [, c2]) => c1 - c2)
    .slice(0, 10);
  sortedBest
    .map(([name, cycles]) => `${cycles.toFixed(4).padStart(20)} -- ${name}`)
    .forEach((s) => console.error(s));
  console.error(`tar czf ${func}.tar.gz ${sortedBest.map(([n]) => n).join(" ")}`);
  console.error(`cp ${sortedBest.map(([n]) => n).join(" ")} ~/c/generated/libsecp256k1/`);
});
