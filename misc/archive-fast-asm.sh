#!/usr/bin/env bash
shopt -s nullglob # dont iterate on empty globs
set -o pipefail   # don't hide errors within pipes
set -e            # die on error
ROOT=$(dirname "$0")
readonly ROOT
echo "root: ${ROOT}"
cd "${ROOT}"

# this script will go through the results folder and archive the fastest N asm files of each to DEST/<DATE>

# destination where to copy the files to
dest=${DEST:-/mnt/pil/x-val/asms/$(date -u +"%Y%m%d%H%M%S")}
mkdir -p "${dest}"

# the N best files
n=${N:-3}

# path from which to get the results from
res=${RES:=$(realpath ./../../../results)}

# load common variables
source ../_internal/_vars

for folder in "${res}"/*/*; do

  infofile="${folder}/${INFO_FILE}"
  if ! test -e "${infofile}"; then
    printf "infofile (%s) does not exist skipping folder.\n" "${infofile}" >&2
    continue
  fi

  head "${infofile}" --lines "${n}" |
    # as the infofile has lines of format <CYCLECOUNT> <FILENAME> and we dont need the cyclecount, we read it into _
    while read -r _ basename; do

      file="${folder}/${basename}"
      test -e "${file}" &&
        cp "${file}" "${dest}"
    done
done

echo "success."
