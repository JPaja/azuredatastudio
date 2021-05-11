#!/bin/bash

# Runs Extension Tests
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
	VSCODEUSERDATADIR=`mktemp -d -t 'myuserdatadir'`
	VSCODEEXTDIR=`mktemp -d -t 'myextdir'`
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
	VSCODEUSERDATADIR=`mktemp -d 2>/dev/null`
	VSCODEEXTDIR=`mktemp -d 2>/dev/null`
	LINUX_NO_SANDBOX="--no-sandbox" # Electron 6 introduces a chrome-sandbox that requires root to run. This can fail. Disable sandbox via --no-sandbox.
fi

# Default to only running stable tests if test grep isn't set
if [[ "$ADS_TEST_GREP" == "" ]]; then
	echo Running stable tests only
	export ADS_TEST_GREP=@UNSTABLE@
	export ADS_TEST_INVERT_GREP=1
fi

# Figure out which Electron to use for running tests
if [ -z "$INTEGRATION_TEST_ELECTRON_PATH" ]
then
	# Run out of sources: no need to compile as code.sh takes care of it
	INTEGRATION_TEST_ELECTRON_PATH="./scripts/code.sh"

	echo "Running integration tests out of sources."
else
	# Run from a built: need to compile all test extensions

	echo "Running integration tests with '$INTEGRATION_TEST_ELECTRON_PATH' as build."
fi

cd $ROOT
echo $VSCODEUSERDATADIR
echo $VSCODEEXTDIR

echo **************************
echo *** starting arc tests ***
echo **************************
"$INTEGRATION_TEST_ELECTRON_PATH" $LINUX_NO_SANDBOX --extensionDevelopmentPath=$ROOT/extensions/arc --extensionTestsPath=$ROOT/extensions/arc/out/integrationTests --user-data-dir=$VSCODEUSERDATADIR --extensions-dir=$VSCODEEXTDIR --disable-telemetry --disable-crash-reporter --disable-updates --nogpu

if [[ "$NO_CLEANUP" == "" ]]; then
	rm -r $VSCODEUSERDATADIR
	rm -r $VSCODEEXTDIR
fi