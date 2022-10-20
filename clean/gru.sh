#!/usr/bin/env bash

shopt -s nullglob # dont iterate on empty globs

# can be called with $1 being a cpulist and $2 being a frequency to set the cpus to while measuring
#               without parameters, defaults to one minion with mask ff and min freq available

set -o pipefail # don't hide errors within pipes
ROOT=$(dirname "$0")
readonly ROOT
echo "root: ${ROOT}"
cd "${ROOT}" || exit 1

# should point to <CRYPTOPT_ROOT>/results
res=${RES:=$(realpath ./../../../results)}
set_frequency_script=../misc/set_frequency.sh

# This array holds the folders like ../fiat_curve25519_carry_square, if some asm files in that folder are considered to be re-evaluated.
# All of those will be re-evaluated in parallel.
# After all the directories have been evaluated, this array here will be used to create ${INFO_FILE_WIP}.
# It is then sorted, slow asms are deleted and ${INFO_FILE} is created.
list_symbol_sort=()

# load common variables
source ./_vars .

function queue() {
  file=${1}
  echo "queueing ${file}"
  echo "${file}" >"${CURVE_QUEUE_NAME}"
}

#returns the number of non-idling minions
function count_alive_minions() {
  alive=0

  while read -r pid _ _ minion_id; do
    if [[ ! -e "${IDLING_PREFIX}.${minion_id}" ]]; then
      # if the minion is not idling, its working we increment result
      ((alive++))
      # echo ${pid} is still alive and working
    fi
  done < <(pgrep --full --list-full --ignore-case 'minion [0-f]+')
  # the pgrep command results a list of the form "<PID> bash minion <MINION_ID>\n"
  # for each active minion.
  printf "\r%02d minions working hard:/" "${alive}"
  return "${alive}"
}

function await_minions() {
  until count_alive_minions; do
    sleep 1
    printf "\b%s" "-"
    sleep 1
    printf "\b%s" "\\"
    sleep 1
    printf "\b%s" "|"
    sleep 1
    printf "\b%s" "/"
  done
}

function reset_freq() {
  sudo ${set_frequency_script} 'default'
}

function kill_minions() {
  while read -r pid; do
    kill "${pid}" 2>/dev/null
    sleep 0
    kill -0 "$pid" 2>/dev/null && sleep 1 && kill -9 "$pid" 2>/dev/null
    echo "killed ${pid}"
  done < <(pgrep --full 'minion [0-f]+')
}

function cleanup() {
  reset_freq
  test -e "${CURVE_QUEUE_NAME}" && rm "${CURVE_QUEUE_NAME}"
  test -e "${CURVE_MINION_LOCK_NAME}" && rm "${CURVE_MINION_LOCK_NAME}"
  kill_minions

  exit 0
}
# call cleanup on signals 1 2 and 15 i.e. SIGHUP SIGINT SIGTERM
trap cleanup 1 2 15

# $1 is the CPU mask to run on
function start_minions() {
  # Setup the queue
  rm --force "${CURVE_QUEUE_NAME}" "${CURVE_MINION_LOCK_NAME}"
  mkfifo "${CURVE_QUEUE_NAME}"

  # Launch N minions in parallel
  for mask in $1; do
    /usr/bin/env bash minion "${mask}" &
    taskset --pid "${mask}" "${!}"
  done
}

function fillQ() {
  for symbol in "${res}"/*/*; do

    # if that info file is already there.
    [[ -e "${symbol}/${INFO_FILE}" ]] &&
      # and there is no newer asm file in that folder
      [[ ! $(find "${symbol}" -newer "${symbol}/${INFO_FILE}" -regex '.*asm') ]] &&
      # we can skip that folder.
      echo "SKIPPED ${symbol}, because there is no newer files (*asm) than ${INFO_FILE}" && continue

    # remove another potential symbol/info-wip file because
    # it needs to be overwritten by subsequent calls, which themselves shall not append to an older file.
    rm --force "${symbol}/${INFO_FILE_WIP}"
    for file in "${symbol}"/*.asm; do
      queue "${file}"
    done
    echo "Q filled with files. Adding ${symbol} to list_symbol_sort"
    list_symbol_sort+=("${symbol}")

  done

}

kill_minions

#$2 may be a frequency.
sudo ${set_frequency_script} 'fix' "${2}"

cpumask=${1:-"ff"}
start_minions "${cpumask}"
fillQ
sleep 1
printf "waiting for all minions to finish analysing.\n"
await_minions

printf "\nAll ASMS have been analysed. Now Sorting / deleting slow files.\n"
reset_freq

echo "Done filling Q with symbols. List_symbol_sort looks like this: ${list_symbol_sort[*]}."
for symbol in "${list_symbol_sort[@]}"; do
  queue "${symbol}"
done
await_minions

cleanup
