#!/usr/bin/env bash

# reads stdin, prints out to stdout
function canonicalise_intel_asm() {

  # create substitution rules
  e_mem="s/\[.*\]/\t[MEM]/"
  e_xconst="s/-\?0x[[:xdigit:]]\+/\tCONST/"
  e_dconst="s/,\s[[:digit:]]\+/,\tCONST/"
  e_reg="s/\([^\s]\)\([a-ds][pi]\?l\)\|\([er][a-ds][ixp]\)\|\(r[89][bdw]\?\)\|\(r[012345]\{2\}[bdw]\?\)/\1\tREG/g"

  # execute the substitution
  sed -e "${e_mem}" -e "${e_xconst}" -e "${e_dconst}" -e "${e_reg}"
}

function skip_after_ret() {
  sed -n -e "1,/ret/p"
}

function count_by_instruction() {
  uniq -c
}

function output_total() {
  wc -l
}

function output_all() {
  filtered=$(cat)
  list=$(
    skip_after_ret <<<"${filtered}" |
      canonicalise_intel_asm |
      sort |
      count_by_instruction
  )
  printf "Sort by Name:\n%s\n" "${list}"
  printf "Sort by Usage Count:\n%s\n" "$(sort --numeric-sort --reverse <<<"${list}")"

  printf "Total: %s\n" "$(output_total <<<"${filtered}")"
}
