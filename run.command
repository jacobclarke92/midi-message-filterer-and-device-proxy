#!/bin/sh

which pnpm >/dev/null 2>&1 || { echo >&2 "pnpm is required but it's not installed.  Aborting."; exit 1; }
which node >/dev/null 2>&1 || { echo >&2 "node is required but it's not installed.  Aborting."; exit 1; }

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

pnpm i

clear

pnpm dev