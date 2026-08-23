#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <release-id> <expected-github-sha> <expected-manifest-sha256>" >&2
  exit 64
fi

release_id=$1
expected_github_sha=$2
expected_manifest_sha256=$3
dev_release_root=/var/www/dev-tenis/releases
production_release_root=/var/www/tenis/releases
production_site_root=/var/www/tenis
origin_host=tenis.walasek.xyz

if [[ $(id -u) -ne 0 ]]; then
  echo "Production promotion must run as root on the deployment host." >&2
  exit 77
fi

if [[ ! $release_id =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]]; then
  echo "Invalid immutable release id: $release_id" >&2
  exit 64
fi

if [[ ! $expected_github_sha =~ ^[0-9a-f]{40}$ ]] || [[ $release_id != "$expected_github_sha"-* ]]; then
  echo "The expected GitHub SHA does not match the release id." >&2
  exit 64
fi

if [[ ! $expected_manifest_sha256 =~ ^[0-9a-f]{64}$ ]]; then
  echo "Invalid trusted release manifest SHA-256." >&2
  exit 64
fi

source_release="$dev_release_root/$release_id"
production_release="$production_release_root/$release_id"
staging_release="$production_release_root/.staging-$release_id-$$"
next_link="$production_site_root/.current-$release_id-$$"
rollback_link="$production_site_root/.rollback-$release_id-$$"
inventory_file=$(mktemp /tmp/mymovio-release-inventory.XXXXXX)
previous=''
staging_created=false
activated=false
verified=false

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  set +e
  if [[ $activated == true && $verified != true ]]; then
    rollback_ok=true
    if [[ -n $previous ]]; then
      if ! mv -Tf "$rollback_link" "$production_site_root/current"; then rollback_ok=false; fi
    else
      if ! unlink "$production_site_root/current"; then rollback_ok=false; fi
    fi
    if [[ $rollback_ok == true ]]; then
      echo "Production deployment interrupted or origin smoke failed; restored $previous" >&2
    else
      echo "CRITICAL: production deployment failed and automatic rollback also failed" >&2
      status=1
    fi
  fi
  rm -f "$inventory_file" "$next_link" "$rollback_link"
  if [[ $staging_created == true ]]; then
    rm -rf -- "$staging_release"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

validate_release() {
  local release=$1
  local unexpected
  local actual_manifest_sha256

  test -d "$release"
  test ! -L "$release"
  unexpected=$(find -P "$release" -mindepth 1 ! -type d ! -type f -print -quit)
  if [[ -n $unexpected ]]; then
    echo "Release contains a symlink or special entry: $unexpected" >&2
    return 1
  fi
  unexpected=$(find -P "$release" \( ! -user root -o ! -group root \) -print -quit)
  if [[ -n $unexpected ]]; then
    echo "Production release is not entirely root-owned: $unexpected" >&2
    return 1
  fi
  unexpected=$(find -P "$release" -type d ! -perm 0755 -print -quit)
  if [[ -n $unexpected ]]; then
    echo "Production release has an unsafe directory mode: $unexpected" >&2
    return 1
  fi
  unexpected=$(find -P "$release" -type f ! -perm 0644 -print -quit)
  if [[ -n $unexpected ]]; then
    echo "Production release has an unsafe file mode: $unexpected" >&2
    return 1
  fi

  test -s "$release/.release-sha256"
  actual_manifest_sha256=$(sha256sum "$release/.release-sha256" | cut -d' ' -f1)
  test "$actual_manifest_sha256" = "$expected_manifest_sha256"
  (
    cd "$release"
    find . -type f ! -path './.release-sha256' -print0 \
      | sort -z \
      | xargs -0 sha256sum
  ) > "$inventory_file"
  cmp "$inventory_file" "$release/.release-sha256"
  (
    cd "$release"
    sha256sum -c .release-sha256 >/dev/null
  )

  test -s "$release/.release.json"
  test -s "$release/index.html"
  test -s "$release/booking.html"
  test -s "$release/training/[id].html"
  test -s "$release/trainer/[id].html"
  grep -Fq "\"github_sha\":\"$expected_github_sha\"" "$release/.release.json"
  grep -Fq "\"release_id\":\"$release_id\"" "$release/.release.json"
  grep -RqsF 'https://phvcbbqshdecbsizxqjw.supabase.co' "$release/_expo/static/js"
  if grep -RqsE '127\.0\.0\.1:54321|replace-with-project-publishable-key|sb_secret_' "$release"; then
    echo "The release contains local, placeholder or secret Supabase configuration." >&2
    return 1
  fi
}

test -d "$source_release"
test ! -L "$source_release"
unexpected_source=$(find -P "$source_release" -mindepth 1 ! -type d ! -type f -print -quit)
if [[ -n $unexpected_source ]]; then
  echo "Development release contains a symlink or special entry: $unexpected_source" >&2
  exit 1
fi

exec 9>"$production_site_root/.deploy.lock"
flock -x 9
if [[ -e $production_release ]]; then
  validate_release "$production_release"
else
  install -d -o root -g root -m 0755 "$staging_release"
  staging_created=true
  rsync -rt --delete --chown=root:root --chmod=D755,F644 \
    "$source_release/" "$staging_release/"
  validate_release "$staging_release"
  mv -T "$staging_release" "$production_release"
  staging_created=false
fi

previous=$(readlink -f "$production_site_root/current" || true)
if [[ -n $previous ]]; then
  ln -s "$previous" "$rollback_link"
fi
ln -s "$production_release" "$next_link"
activated=true
mv -Tf "$next_link" "$production_site_root/current"

if ! {
  curl --noproxy '*' -fsS --resolve "$origin_host:80:[::1]" "http://$origin_host/" | cmp - "$production_release/index.html" \
    && curl --noproxy '*' -fsS --resolve "$origin_host:80:[::1]" "http://$origin_host/booking" | cmp - "$production_release/booking.html" \
    && curl --noproxy '*' -fsS --resolve "$origin_host:80:[::1]" "http://$origin_host/training/release-smoke" | cmp - "$production_release/training/[id].html" \
    && curl --noproxy '*' -fsS --resolve "$origin_host:80:[::1]" "http://$origin_host/__spa_release_smoke__" | cmp - "$production_release/index.html"
}; then
  exit 1
fi

verified=true
echo "Promoted verified release $release_id to production."
