#!/usr/bin/env bash
# One-shot domestic Lighthouse setup for WeCom callback (asia-power.cn).
# Run ON THE DOMESTIC SERVER as root after code + .env are in place.
#
# From Mac (after CEO provides Lighthouse IP + SSH access):
#   rsync -az --exclude '.venv*' --exclude '.git' --exclude 'node_modules' \
#     --exclude 'data/' --exclude 'work/' \
#     /Users/longhui/Desktop/AsiaPower/ root@LIGHTHOUSE_IP:/opt/AsiaPower/
#   scp .env root@LIGHTHOUSE_IP:/opt/AsiaPower/.env   # WECOM_* + OPENAI_API_KEY only
#   ssh root@LIGHTHOUSE_IP 'WECOM_ROOT=/opt/AsiaPower CERTBOT_EMAIL=you@example.com bash /opt/AsiaPower/deploy/install-wecom-domestic.sh'
#
set -euo pipefail

WECOM_ROOT="${WECOM_ROOT:-/opt/AsiaPower}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
DOMAIN="${WECOM_DOMAIN:-asia-power.cn}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Error: run as root" >&2
  exit 1
fi

echo "[domestic] AsiaPower WeCom domestic install — ${DOMAIN}"
echo "[domestic] WECOM_ROOT=${WECOM_ROOT}"

if [[ ! -d "${WECOM_ROOT}/integrations" ]]; then
  echo "Error: ${WECOM_ROOT}/integrations missing — rsync AsiaPower repo first." >&2
  exit 1
fi

if [[ ! -f "${WECOM_ROOT}/.env" ]]; then
  echo "Error: ${WECOM_ROOT}/.env missing — copy WECOM_* from local .env first." >&2
  exit 1
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq nginx certbot python3-certbot-nginx python3-venv python3-pip curl
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx python3 python3-pip curl epel-release 2>/dev/null || dnf install -y nginx python3 python3-pip curl
    if ! command -v certbot >/dev/null 2>&1; then
      dnf install -y certbot python3-certbot-nginx 2>/dev/null || dnf install -y certbot 2>/dev/null || true
    fi
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    yum install -y nginx python3 python3-pip curl epel-release 2>/dev/null || yum install -y nginx python3 python3-pip curl
    if ! command -v certbot >/dev/null 2>&1; then
      yum install -y certbot python3-certbot-nginx 2>/dev/null || yum install -y certbot 2>/dev/null || true
    fi
    return
  fi
  echo "Error: no apt-get/dnf/yum found" >&2
  exit 1
}

echo "[domestic] Installing system packages..."
install_packages

mkdir -p /var/www/certbot

echo "[domestic] Python venv + deps..."
if [[ ! -x "${WECOM_ROOT}/.venv/bin/python" ]]; then
  python3 -m venv "${WECOM_ROOT}/.venv"
fi
"${WECOM_ROOT}/.venv/bin/pip" install -q -U pip
"${WECOM_ROOT}/.venv/bin/pip" install -q -r "${WECOM_ROOT}/requirements-ai-os.txt"

# Ensure production URL in .env
if grep -q '^WECOM_PUBLIC_BASE_URL=' "${WECOM_ROOT}/.env"; then
  sed -i "s|^WECOM_PUBLIC_BASE_URL=.*|WECOM_PUBLIC_BASE_URL=https://${DOMAIN}|" "${WECOM_ROOT}/.env"
else
  echo "WECOM_PUBLIC_BASE_URL=https://${DOMAIN}" >> "${WECOM_ROOT}/.env"
fi

echo "[domestic] nginx site..."
NGINX_SITE="${WECOM_ROOT}/deploy/nginx-asia-power.cn"
if [[ -d /etc/nginx/sites-available ]]; then
  cp "${NGINX_SITE}" "/etc/nginx/sites-available/${DOMAIN}"
  ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
else
  cp "${NGINX_SITE}" "/etc/nginx/conf.d/${DOMAIN}.conf"
  rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
fi
nginx -t
systemctl enable nginx
systemctl start nginx 2>/dev/null || true
systemctl reload nginx

RESOLVED_IP="$(getent hosts "${DOMAIN}" | awk '{print $1; exit}' || true)"
PUBLIC_IP="$(curl -sS -m 5 https://ifconfig.me 2>/dev/null || curl -sS -m 5 https://api.ipify.org 2>/dev/null || true)"
if [[ -n "${RESOLVED_IP}" && -n "${PUBLIC_IP}" && "${RESOLVED_IP}" != "${PUBLIC_IP}" ]]; then
  echo "Warning: ${DOMAIN} resolves to ${RESOLVED_IP} but this server is ${PUBLIC_IP} — fix DNS A record before certbot." >&2
fi

if [[ -n "${CERTBOT_EMAIL}" ]] && command -v certbot >/dev/null 2>&1; then
  echo "[domestic] certbot HTTPS..."
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" --redirect || {
    echo "Warning: certbot failed — DNS may not point here yet. Retry after A record propagates." >&2
  }
elif [[ -n "${CERTBOT_EMAIL}" ]]; then
  echo "Warning: certbot not installed — configure HTTPS manually." >&2
else
  echo "[domestic] Skip certbot (set CERTBOT_EMAIL=... to auto-issue Let's Encrypt cert)."
fi

echo "[domestic] systemd wecom-callback..."
WECOM_ROOT="${WECOM_ROOT}" bash "${WECOM_ROOT}/deploy/install-wecom-callback.sh"

echo ""
echo "=== Domestic WeCom deploy summary ==="
echo "  Domain:     https://${DOMAIN}"
echo "  Callback:   https://${DOMAIN}/wecom/callback"
echo "  Server IP:  ${PUBLIC_IP:-unknown}  (add to WeCom 企业可信 IP)"
echo "  Status:     systemctl status wecom-callback"
echo "  Logs:       journalctl -u wecom-callback -f"
echo "  Verify:     cd ${WECOM_ROOT} && .venv/bin/python scripts/wecom-verify-config.py"
echo ""
echo "CEO: save https://${DOMAIN}/wecom/callback in WeCom admin → 接收消息 → API 接收"
