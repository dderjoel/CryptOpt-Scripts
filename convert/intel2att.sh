#!/usr/bin/env bash
set -e

namespace=0
[[ "${1}" == "--crypto-namespace" ]] && shift && namespace=1

inputfile="${1}"

if ! test -f "${inputfile}"; then
  echo "Usage: ${0} path/to/asm/file.asm. It will be nasm'd and objdump'ed. Then result will be printed to stdout. You can use --crypto-namespace as the first argument, to wrap the symbol in 'CRYPTO_NAMESPACE(symb)'" >&2
  echo ">>$1<< does not seem to be a file" >&2
  exit 1
fi

# assemble the input
INTERMEDIATE_FILE=$(mktemp)
nasm "${inputfile}" -f elf64 -o "${INTERMEDIATE_FILE}"

# get the symbol
symbol=$(objdump --syms --section=.text "${INTERMEDIATE_FILE}" | sed -n "s/^[0-f]* g.*\.text\s*[0-f]\+ //p")

# write header
if [[ ${namespace} -eq 1 ]]; then
  printf ".text\n.global %s\n%s:\n" "CRYPTO_NAMESPACE(${symbol})" "CRYPTO_NAMESPACE(${symbol})"
else
  printf ".text\n.global %s\n%s:\n" "${symbol}" "${symbol}"
fi

# write code
objdump --disassemble="${symbol}" --no-show-raw-insn --no-addresses "${INTERMEDIATE_FILE}" | tail -n +8

# cleanup
rm "${INTERMEDIATE_FILE}"
