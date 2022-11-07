#!/usr/bin/env bash

source ../_internal/_vars

# this is probbaly not needed
# test ! -d "./node_modules/ts-node/package.json" && PATH="${PATH}:${NODE_PATH}" npm install
PATH="${PATH}:${NODE_PATH}" ./x-val.ts "${@}"
