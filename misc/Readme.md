# What is this?

Miscellaneous scripts.



## Okay, what do we find in here?

| Script | Description |
|-----|----
| `set_frequency.sh`  | (re-)sets and reads the frequency, boost setting and governor. |
| `bench_supercop.sh` | used to trigger benchmarking on all machines, then generate latex and run make to generate tables. |
| `x-val.ts` | Performns cross validation of all `asm` files found in `#1` and against their symbols with `gcc` and `clang`. Writes JSON to `#2`. |
| `x-val.sh` | Wrapper around `x-val.ts`. |
