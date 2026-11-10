#!/usr/bin/env bash
# Redeploys the mock backend to the existing web app. Run from the repo root in Git Bash: bash backend/deploy.sh
# Posts the zip straight to the publish API with an Azure AD token ("az webapp deploy" returned 403 from this machine).
set -euo pipefail
set -a; . ./.env; set +a
SUB="${AZ_SUBSCRIPTION:?set AZ_SUBSCRIPTION in .env}"
node testset/build-cases.mjs
rm -f backend.zip
/c/Windows/System32/tar.exe -a -c -f backend.zip -C backend local-server.mjs package.json src
TOKEN=$(az account get-access-token --subscription "$SUB" --resource https://management.azure.com/ --query accessToken -o tsv)
curl -s -o /dev/null -w "publish http=%{http_code}\n" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/zip" \
  --data-binary @backend.zip "https://$APP_NAME.scm.azurewebsites.net/api/publish?type=zip&async=false&restart=true&clean=true"
