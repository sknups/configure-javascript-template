#!/usr/bin/env bash

DEPENDENCIES=$(jq -r ' (.devDependencies // {}, .dependencies // {} ) | keys[]' package.json)

if grep -q "@sknups-internal/" <<< "$DEPENDENCIES" ; then
  {
    echo "authenticate=true"
    echo "workload_identity_provider=projects/702125700768/locations/global/workloadIdentityPools/github-identity-pool/providers/github-identity-provider"
    echo "service_account=npm-internal-reader-gh@sknups.iam.gserviceaccount.com"
  } >> "$GITHUB_OUTPUT"
  echo "this project depends on package(s) scoped '@sknups-internal'"
else
  echo "authenticate=false" >> "$GITHUB_OUTPUT"
fi

