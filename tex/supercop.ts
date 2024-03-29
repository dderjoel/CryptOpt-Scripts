#!/usr/bin/env ts-node
import { readdirSync, readFileSync } from "fs";
import { groupBy, minBy, set } from "lodash";
import path from "path";

// padding constants to have beautified latex
const PAD_CYC = 44;
const PAD_NAME = 42;
const PAD_FIELD = 14;
const FACTOR: 1 | 1000 = 1000; // 1k
const ROWCOLORS = [
  { m: "\\rowA", c: `\\cellcolor[rgb]{${Array(3).fill("0.9").join(",")}}` },
  { m: "\\rowB", c: `\\cellcolor[rgb]{${Array(3).fill("1.0").join(",")}}` },
];
const macrolen = Math.min(...ROWCOLORS.map(({ m }) => m.length + 1));
const ROW_DESCRIPTION = "Implementation".padEnd(PAD_NAME + macrolen);
const FIELD_DESCRIPTION = "Lang.".padStart(PAD_FIELD + macrolen);
const MEAN_DESCRIPTION = "G.M.".padStart(PAD_CYC);

const CAPTION_MAP: {
  [curve: string]: { heading: string; offset: string };
} = {
  curve25519: { heading: "Curve25519", offset: "-2em" },
  // p256: { heading: "P-256" },
  // p384: { heading: "P-384" },
  secp256k1: { heading: "secp256k1", offset: "+.6em" },
};

const implOrder = [
  [
    "curve25519/sandy2x", // vector in ladder_base.S
    "curve25519/amd64-64", // scalar asm; fe64 no vector
    "curve25519/amd64-51", // scalar asm; fe51 no vector
    "curve25519/donna", // uses vectors in asm.S
    "curve25519/donna_c64", // C (fe51)
    "curve25519/openssl-c-ots", // C (fe51)
    "curve25519/openssl-ots", // asm (fe51)
    // NOTE, there is no C fe64
    "curve25519/openssl-fe51-cryptopt", // fiat unsaturated       (optimized)
    "curve25519/openssl-fe64-ots", //asm fe64
    "curve25519/openssl-fe64-cryptopt", // fiat saturated solinas (optimized)
    "curve25519/openssl-fe51-champ", // cryptopt based but GM-best on all machines
    "curve25519/openssl-fe64-champ", // cryptopt based but GM-best on all machines
    // "curve25519/openssl-fe64-fiat", //     fiat saturated solinas (C)

    // "curve25519/everest-hacl-51", // C based
// "curve25519/everest-hacl-64", // asm   based
    // "curve25519/everest-hacl-64-cryptopt", // asm   based but fmul2 from fiat+CO
    // "curve25519/everest-hacl-lib-51", // precompiled
    // "curve25519/everest-hacl-lib-64", // precompiled

    // "curve25519/openssl-fe64-w-armdazh", // https://github.com/armfazh/rfc7748_precomputed
  ],

  [
    "secp256k1/libsecp256k1-ots", // hand assembly in field_5x52_asm_impl.h
    "secp256k1/libsecp256k1-c-ots",
    // "secp256k1/libsecp256k1-ots-c-dettman",
    "secp256k1/libsecp256k1-ots-cryptopt-dettman",
    "secp256k1/libsecp256k1-ots-cryptopt-bcc",
    "secp256k1/libsecp256k1-ots-champ-dettman", // GM best on all machines
    "secp256k1/libsecp256k1-ots-champ-bcc", // GM best on all machines
  ],
];
const implMap = {
  // CURVE25519
  "curve25519/sandy2x": { name: "sandy2x~\\cite{sandy2x}", field: "av" },
  "curve25519/amd64-51": { name: "amd64-51~\\cite{Chen14}", field: "a64" },
  "curve25519/amd64-64": { name: "amd64-64~\\cite{Chen14}", field: "a64" },
  "curve25519/donna": { name: "donna~\\cite{curve25519-donna}", field: "av" },
  "curve25519/donna_c64": { name: "donna-c64~\\cite{curve25519-donna}", field: "c51" },
  "curve25519/openssl-c-ots": { name: "OSSL ots~\\cite{openssl}", field: "c51" },
  "curve25519/openssl-ots": { name: "OSSL fe-51 ots~\\cite{openssl}", field: "a51" },
  "curve25519/openssl-fe64-ots": { name: "OSSL fe-64 ots~\\cite{openssl}", field: "a64" },
  "curve25519/openssl-fe51-cryptopt": { name: "OSSL fe-51+\\textbf\\cryptopt", field: "a51" },
  "curve25519/openssl-fe64-cryptopt": { name: "OSSL fe-64+\\textbf\\cryptopt", field: "a64" },
  "curve25519/openssl-fe51-champ": { name: "OSSL fe-51+\\textbf {Best}", field: "a51" },
  "curve25519/openssl-fe64-champ": { name: "OSSL fe-64+\\textbf {Best}", field: "a64" },
  "curve25519/openssl-fe64-fiat": { name: "OSSL fe-64+Fiat-C", field: "c64" },
  "curve25519/openssl-fe64-cryptopt-eql": { name: "OSSL 64+\\textbf\\cryptopt(mul as sq)", field: "a64" },
  "curve25519/openssl-fe64-fiat-eql": { name: "OSSL 64+Fiat-C (mul as sq)", field: "c64" },
  "curve25519/everest-hacl-51": { name: "HACL*~fe-51~\\cite{hacl}", field: "c51" }, // c   based
  "curve25519/everest-hacl-64": { name: "HACL*~fe-64~\\cite{hacl}", field: "a64" }, // asm based
  // "curve25519/everest-hacl-64-cryptopt": { name: "HACL*~fe-64~\\cite{hacl}+\\textbf\\cryptopt (fmul2 only)", field: "a64", },
  "curve25519/everest-hacl-lib-51": { name: "HACL*~fe-51~\\cite{hacl}", field: "bin" }, // precompiled
  "curve25519/everest-hacl-lib-64": { name: "HACL*~fe-64~\\cite{hacl}", field: "bin" }, // precompiled
  // "curve25519/openssl-fe64-w-armdazh": { name: "OSSL fe-64 + (RFC7748~\\cite{oliveira_sac2017})", field: "a64", }, // https://github.com/armfazh/rfc7748_precomputed

  // SECP256k1
  "secp256k1/openssl-ots": { name: "OSSL ots", field: "c port" },
  "secp256k1/openssl-cryptopt": { name: "OSSL+\\textbf\\cryptopt", field: "sa" },
  "secp256k1/libsecp256k1-ots": { name: "libsecp256k1~\\cite{libsecp256k1}", field: "sa" },
  "secp256k1/libsecp256k1-c-ots": { name: "libsecp256k1~\\cite{libsecp256k1}", field: "c52" },
  "secp256k1/libsecp256k1-ots-c-dettman": { name: "libsecp256k1+Dettman", field: "c52" },
  "secp256k1/libsecp256k1-ots-cryptopt-dettman": {
    name: "libsecp256k1+\\textbf\\cryptopt (Fiat)",
    field: "sa",
  },
  "secp256k1/libsecp256k1-ots-cryptopt-bcc": { name: "libsecp256k1+\\textbf\\cryptopt (Opt)", field: "sa" },
  "secp256k1/libsecp256k1-ots-champ-dettman": { name: "libsecp256k1+\\textbf {Best (Fiat)}", field: "sa" },
  "secp256k1/libsecp256k1-ots-champ-bcc": { name: "libsecp256k1+\\textbf {Best (Opt)}", field: "sa" },
} as { [impl: string]: { name: string; field: string } };

const machineOrder = [
  "kivsa",
  "nakhash",
  "aljamus",
  "dag",
  "nuc",
  "akrav",
  "akavish",
  "pil",
  "arnevet",
  "ez",
];

const machinenameMap: { [hostname: string]: string } = {
  kivsa: "1900X",
  nakhash: "5800X",
  aljamus: "5950X",
  dag: "7950X",
  nuc: "i7 6G",
  akrav: "i7 10G",
  akavish: "i9 10G",
  pil: "i7 11G",
  arnevet: "i9 12G",
  ez: "i9 13G",
};
const languageMap: { [secificImplName: string]: string } = {
  "c port": "C",
  c: "C",
  c64: "C",
  c52: "C",
  c51: "C",
  av: "asm-v",
  a64: "asm",
  a51: "asm",
  sa: "asm",
};
function fieldToStr(implName: string): string {
  if (!(implName in implMap)) {
    return `-${implName}`;
  }
  const field = implMap[implName]?.field;
  if (field in languageMap) {
    return languageMap[field];
  }
  return field;
}

// console.log(`\\setlength{\\tabcolsep}{${sep}}`);
const genBarTable = (): string => {
  // \\def\\cyclebar#1#2#3#4{%%
  //     {#4{${
  //       FACTOR == 1 ? "\\tiny#1" : "\\small#1k"
  //     }}} & {\\hspace{-2mm}\\color{#3!#2}\\rule[-1pt]{#1${MAX_WIDTH_UNIT}}{6.5pt}}}

  const head = [
    ...ROWCOLORS.map(({ c, m }) => `\\newcommand{${m}}{${c}}`),
    `\\begin{tabular}{cll${machineOrder.map(() => "r").join("")}r}`,
    "\\toprule",
    [
      "", // for curve column
      ROW_DESCRIPTION,
      FIELD_DESCRIPTION,
      ...machineOrder.map((m) => machinenameMap[m].padStart(PAD_CYC + macrolen)),
      MEAN_DESCRIPTION,
    ].join(" & ") + "\\\\",
    "", // to get another  \\n
  ].join("\n");

  const meat = implOrder
    .map((implementations) => {
      // something like p256
      const folderFolder = implementations[0].split("/")[0];
      const { heading, offset } = CAPTION_MAP[folderFolder];

      // mapped and filtered data
      const d = implementations
        .map((ii) => {
          if (!(ii in implMap)) {
            throw new Error(ii + " not in impl");
          }
          return {
            field: fieldToStr(ii),
            name: implMap[ii]?.name ?? "-" + ii + "- ",

            iname: ii,
            byMachine: Object.entries(data).find(([i]) => i == ii)?.[1],
          };
        })
        .filter(({ byMachine }) => typeof byMachine !== "undefined") as {
        name: string; // displayName (sandy2x)
        iname: string; // implname (curve25519/sandy2x)
        field: string; // fieldimpl (asm || asm-v || ...)
        byMachine: { [m: string]: number };
      }[];

      // last column
      const meanByImplementation = d.reduce((acc, { byMachine, iname }) => {
        const mul = machineOrder.reduce((a, m) => a * byMachine[m], 1);
        acc[iname] = Math.pow(mul, 1 / machineOrder.length);
        return acc;
      }, {} as { [impl: string]: number });

      const smallestMean = Math.min(...Object.values(meanByImplementation));

      const smallestImplByMachine = machineOrder.reduce((acc, machine) => {
        const min = Math.min(...d.map(({ byMachine }) => byMachine[machine]));
        acc[machine] = min;
        return acc;
      }, {} as { [machine: string]: number });

      const printCycles = (c: number, small: number): string => {
        const isSmallest = c == small;
        const ratio = (c / small).toFixed(2);
        const ratioStr = `{\\tiny (${ratio}x)}`;
        const cyclesStr = (FACTOR as number) === 1000 ? `${(c / FACTOR).toFixed(0)}k` : c;

        let m = isSmallest ? `\\textbf{${cyclesStr} ${ratioStr}}` : `${cyclesStr} ${ratioStr}`;
        m += "\\hspace{-.5em}";
        return m.padStart(PAD_CYC);
      };

      return [
        "\\midrule",
        `\\multirow{${implementations.length}}{*}[${offset}]{\\rotatebox[origin=c]{90}{\\centering ${heading}}}`,
        ...d.map(
          ({ name, byMachine, iname, field }, i) =>
            " & " +
            [
              name.padEnd(PAD_NAME),
              field.padStart(PAD_FIELD),
              ...machineOrder.map((machine) =>
                printCycles(byMachine[machine], smallestImplByMachine[machine]),
              ),
              printCycles(meanByImplementation[iname], smallestMean),
            ]
              .map((v) => `${ROWCOLORS[i % 2].m} ${v}`)
              .join(" & ") +
            " \\\\",
        ),
      ].join("\n");
    })
    .join("\n\n");

  const bottom = ["", "\\bottomrule", "\\end{tabular}"].join("\n");

  return head + meat + bottom;
};

const dir = process.argv[2];

const DB_REG_OK =
  /(?<supercopversion>\d+) (?<host>\w+) (?<abi>\w+) (?<date>\d+) (?<primitive>\w+) (?<timecop>[\w/]+) try(\(\w+placeasm:\w+\))? (?<checksum>[\w/]+) (ok|unknown) (?<cycles>\d+) (?<chksmcycles>\d+) (?<cyclespersecond>\d+) crypto_scalarmult\/(?<impl>[-\w/]+) (?<cc>[/\w]+)_(?<cflags>[-=\w/]+)/;
// const DB_REG_CYCLES = /(?<supercopversion>\d+) (?<host>\w+) (?<abi>\w+) (?<date>\d+) (?<primitive>\w+) (?<timecop>[\w\/]+) try (?<checksum>[\w\/]+) ok (?<cycles>\d+) (?<chksmcycles>\d+) (?<cyclespersecond>\d+) crypto_scalarmult\/(?<impl>[\w\/]+) (?<cc>[/\w]+)_(?<cflags>[-=\w\/]+)/;

const data = readdirSync(dir)
  .filter((hostname) => machineOrder.includes(hostname))
  .reduce((acc, hostname: string) => {
    const datafile = readFileSync(path.resolve(dir, hostname, "data"))
      .toString()
      .split("\n")
      .filter((line) => !line?.includes("objsize"))
      .map((line) => DB_REG_OK.exec(line)?.groups as { impl: string; cycles: string; host: string })
      .filter((group) => group) // filter undefined
      .map(({ impl, cycles, host: machine }) => ({
        impl,
        cycles: Number(cycles),
        // cc: cc,
        // cflags: cflags,
        machine,
      })); // just carry needed keys

    const grouped = groupBy(datafile, "impl");
    Object.entries(grouped).forEach(([impl, values]) => {
      // find smallest entry(from all the compiler-combinations) by cycles
      const mins = minBy(values, "cycles");
      if (!mins) {
        throw new Error("should have mins here");
      }
      // and add it into the accumulator
      set(acc, `${impl}.${mins.machine}`, mins.cycles);
    });

    return acc;
  }, {} as { [impl: string]: { [machine: string]: number } });

console.log(genBarTable());
