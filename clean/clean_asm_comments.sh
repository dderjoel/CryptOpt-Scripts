#!/usr/bin/env bash

for f in ${1}; do
  sed -i -e 's@^\([^;]\+\);.*$@\1@' "${f}"
done

# could be called with  find /tmp/myfiles -name '*.asm' -exec clean_asm_comments.sh {} \;
