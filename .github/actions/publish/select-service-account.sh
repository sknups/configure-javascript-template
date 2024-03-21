#!/usr/bin/env bash

if [[ "$SCOPE" == "@sknups-internal" ]]; then
  echo "workload_identity_provider=projects/702125700768/locations/global/workloadIdentityPools/github-identity-pool/providers/github-identity-provider" >> "$GITHUB_OUTPUT"
  echo "service_account=npm-internal-writer-gh@sknups.iam.gserviceaccount.com" >> "$GITHUB_OUTPUT"
  echo "service account is npm-internal-writer-gh@sknups.iam.gserviceaccount.com"
fi

if [[ "$SCOPE" == "@sknups" ]]; then
  echo "workload_identity_provider=projects/702125700768/locations/global/workloadIdentityPools/github-identity-pool/providers/github-identity-provider" >> "$GITHUB_OUTPUT"
  echo "service_account=npm-public-writer-gh@sknups.iam.gserviceaccount.com" >> "$GITHUB_OUTPUT"
  echo "service account is npm-public-writer-gh@sknups.iam.gserviceaccount.com"
fi
