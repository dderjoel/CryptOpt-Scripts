#!/usr/bin/env bash

source ../_internal/_vars

# this is probbaly not needed
# test ! -d "./node_modules/" && PATH="${PATH}:${NODE_PATH}" npm install
PATH="${NODE_PATH}:${PATH}" ./x-val.js "${@}" 2>/dev/null
