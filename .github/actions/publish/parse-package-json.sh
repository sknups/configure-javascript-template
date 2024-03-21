#!/usr/bin/env bash

ERROR=1

PACKAGE_PRIVATE=$(jq '.private' -r package.json)
PACKAGE_SCOPE=$(jq -r '.name' package.json | cut -d'/' -f1)
PACKAGE_NAME=$(jq -r '.name' package.json | cut -d'/' -f2)

if [ "$PACKAGE_PRIVATE" == "true" ] ; then

  echo "action=ignore" >> "$GITHUB_OUTPUT"
  echo "package.json contains 'private' flag, npm package will NOT be published"

else

  if [[ "${PACKAGE_NAME}" =~ ^javascript-template$ ]] ; then

    LINE=$(grep -n '"name":' package.json | cut -d: -f1)
    echo "::error file=package.json,line=${LINE}::Package must be renamed from \"javascript-template\" before it can be published to npm registry" >> /dev/stderr
    exit $ERROR

  fi

  if [[ "${PACKAGE_SCOPE}" = @sknups ]] ; then

    echo "action=publish" >> "$GITHUB_OUTPUT"
    echo "scope=@sknups" >> "$GITHUB_OUTPUT"
    echo "npm package will be published to the PUBLIC npm registry"

  elif [[ "${PACKAGE_SCOPE}" = @sknups-internal ]] ; then

    echo "action=publish" >> "$GITHUB_OUTPUT"
    echo "scope=@sknups-internal" >> "$GITHUB_OUTPUT"
    echo "npm package will be published to the internal npm registry"

  else

    LINE=$(grep -n '"name":' package.json | cut -d: -f1)
    echo "::error file=package.json,line=${LINE}::Package scope must either be @sknups or @sknups-internal" >> /dev/stderr
    exit $ERROR

  fi

fi
