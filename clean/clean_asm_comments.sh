#!/usr/bin/env bash

[[ ${#} -lt 1 ]] && echo "Should be called with  find /tmp/myfiles -name '*.asm' -exec ${0} {} \;" >&2 && exit 1

for f in ${1}; do
  sed -i -e 's@^\([^;]\+\);.*$@\1@' "${f}"
done
