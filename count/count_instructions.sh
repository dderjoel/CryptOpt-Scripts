#!/usr/bin/env bash
source "$(dirname ${0})/../_internal/count_instructions_helper.sh"

[[ $# -lt 1 ]] &&
  echo -e "Usage: ${0} [-t|-total] [-s|--symbol=function_name] FILENAME.[so|o|asm] \nNote: Will use first found global symbol by default if no function_name was given\nIf --total is given, it will only print the number of total instructions." &&
  exit 1

temp=$(getopt -o "vts:" --longoptions "total,verbose,symbol:" -- "${@}")
eval set -- "${temp}"

total=0
verbose=0
while true; do
  case "$1" in
  -t | --total)
    total=1
    ;;
  -v | --verbose)
    verbose=1
    ;;
  -s | --symbol)
    shift
    symbol=$1
    ;;
  --)
    shift
    break
    ;;
  esac
  shift
done

# get and check filename
file_name=${1}
[[ ! -e "${file_name}" ]] &&
  echo "${file_name} could not be found" &&
  exit 1

# and check the extension
[[ "${file_name##*.}" == "asm" ]] &&
  is_asm=1 ||
  is_asm=0

function get_clean_from_object() {

  # getting function name if none was set via options
  [[ -n ${symbol} ]] &&
    function_name=${symbol} ||
    function_name=$(
      objdump --syms --section=.text "${file_name}" |
        grep -e "[[:xdigit:]]\+ g" |
        head --lines=1 |
        awk '{ print $NF }'
    )

  # debug info
  [[ $verbose -eq 1 ]] &&
    echo "Counting instructions of function <${function_name}> in file <${file_name}>" >&2

  e1="1,/<.*>:/d"    # delete until functionsymbol
  e2="s/QWORD PTR//" # delete QWORD keyword

  # disassemble
  objdump "${file_name}" \
    --no-show-raw-insn --no-addresses \
    --disassemble="${function_name}" \
    --section=.text \
    -M intel |
    # clean
    sed -e "${e1}" -e "${e2}"
}

function get_clean_from_asm() {
  e1="1,/.*:/d" # delete until functionsymbol
  e2="s/byte//" # delete byte keyword
  e3="s/;.*//"  # delete comments

  # debug info
  [[ $verbose -eq 1 ]] &&
    echo "Counting instructions of asm  <${file_name}>" >&2

  # clean
  sed <"${file_name}" -e "${e1}" -e "${e2}" -e "${e3}"
}

#get instructions
if [[ ${is_asm} -eq 1 ]]; then
  instructions=$(get_clean_from_asm)
else
  instructions=$(get_clean_from_object)
fi

# print
if [[ $total -eq 1 ]]; then
  output_total <<<"${instructions}"
else
  output_all <<<"${instructions}"
fi

exit 0
