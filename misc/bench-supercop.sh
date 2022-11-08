#!/usr/bin/env bash

set -e
dir=/mnt/pil/su/supercop-20221005/bench

ansibledir=$(realpath "$(dirname "$0")/../ansible/")
texdir=$(realpath "$(dirname "$0")/../tex/")

echo run benchmark
pushd "${ansibledir}"
ansible-playbook ./bench-supercop.playbook.yml
popd

echo mount pil locally
if test ! -d "${dir}"; then
  echo -n 'Pil not mounted locally. trying to mount... '
  mount /mnt/pil
  echo "mounted."
fi

# assumes a tex-project in ~/p/

# if there is no makefile there, we will exit here because of set -e
test -f ~/p/Makefile

echo generate tex

pushd "${texdir}"
./supercop.ts "${dir}" >~/p/scmul.tex
popd

echo make pdf
make -C ~/p
