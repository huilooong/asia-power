# AsiaPower — production nginx vhost (asia-power.com)
# Deploy: /etc/nginx/sites-available/asia-power.com
#
# IMPORTANT — read deploy/SITE-HEALTH.md before editing.
# Do NOT add nginx `root` + try_files for /css/ /js/ under /root/ (www-data cannot read → 404 + cached "stone age" site).

# Site is proxied through Cloudflare — $remote_addr is Cloudflare's edge IP, not the
# visitor's. Use CF-Connecting-IP (set by Cloudflare) so analytics/rate-limiting see
# the real client IP; fall back to $remote_addr for direct/non-Cloudflare requests.
map $http_cf_connecting_ip $real_client_ip {
    default $http_cf_connecting_ip;
    ""      $remote_addr;
}

server {
    server_name www.asia-power.com;
    return 301 https://asia-power.com$request_uri;

    listen [::]:443 ssl;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/aspowe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aspowe.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    server_name asia-power.com;

    # 运行时 DNS 解析，强制 IPv4，60s 缓存
    resolver 8.8.8.8 1.1.1.1 valid=60s ipv6=off;
    resolver_timeout 5s;

    client_max_body_size 55m;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml text/xml application/xml;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Block sensitive paths at the edge (defense in depth)
    location ^~ /data/ { return 404; }
    location ^~ /server/ { return 404; }
    location ^~ /deploy/ { return 404; }
    location ^~ /scripts/ { return 404; }
    location = /.env { return 404; }

    # Admin & management APIs — auth enforced by Node (session + role), not IP whitelist

    location ^~ /admin/ {
        add_header X-Robots-Tag "noindex, nofollow" always;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/login {
        limit_req zone=asiapower_login burst=5 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/logout {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/me {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/half-cuts/state {
        limit_req zone=asiapower_api burst=30 nodelay;
        client_body_timeout 120s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/pending {
        limit_req zone=asiapower_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/inbound-intake {
        limit_req zone=asiapower_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/items {
        limit_req zone=asiapower_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/posts {
        limit_req zone=asiapower_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/api/items/[^/]+$ {
        limit_req zone=asiapower_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/api/pending/[^/]+/approve$ {
        limit_req zone=asiapower_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /supplier-portal/upload-key.js {
        add_header Cache-Control "no-store" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /supplier-portal/half-cut-upload.html {
        add_header X-Robots-Tag "noindex, nofollow" always;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Half-cut media — served from Cloudflare R2 via media.asia-power.com
    location ^~ /uploads/photos/ {
        set $r2_host media.asia-power.com;
        proxy_pass https://$r2_host;
        proxy_set_header Host media.asia-power.com;
        proxy_ssl_server_name on;
        proxy_ssl_name media.asia-power.com;
        expires 7d;
        add_header Cache-Control "public, max-age=604800" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-AsiaPower-Storage "r2" always;
        access_log off;
    }

    location ^~ /uploads/videos/ {
        set $r2_host media.asia-power.com;
        proxy_pass https://$r2_host;
        proxy_set_header Host media.asia-power.com;
        proxy_ssl_server_name on;
        proxy_ssl_name media.asia-power.com;
        expires 7d;
        add_header Cache-Control "public, max-age=604800" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-AsiaPower-Storage "r2" always;
        access_log off;
    }

    location ^~ /uploads/pending/photos/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1h;
        add_header Cache-Control "private, max-age=3600" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-AsiaPower-Storage "app-verified" always;
        access_log off;
    }

    location ^~ /uploads/pending/videos/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1h;
        add_header Cache-Control "private, max-age=3600" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-AsiaPower-Storage "app-verified" always;
        access_log off;
    }

    location = /api/half-cuts/upload/presign {
        limit_req zone=asiapower_upload burst=60 nodelay;
        client_body_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/half-cuts/upload-token {
        limit_req zone=asiapower_upload burst=40 nodelay;
        client_body_timeout 30s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ^~ /api/half-cuts/upload/ {
        limit_req zone=asiapower_upload burst=50 nodelay;
        client_body_timeout 120s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/half-cuts/submissions {
        limit_req zone=asiapower_upload burst=30 nodelay;
        client_body_timeout 60s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ^~ /api/ {
        limit_req zone=asiapower_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WeCom 企业微信回调 — AsiaPower 库存 Agent（子敬）；Python @127.0.0.1:8791
    location = /wecom/callback {
        proxy_pass http://127.0.0.1:8791;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        client_max_body_size 2m;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/aspowe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aspowe.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    server_name aspowe.com www.aspowe.com;
    return 301 https://asia-power.com$request_uri;

    listen [::]:443 ssl;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/aspowe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aspowe.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.asia-power.com) {
        return 301 https://asia-power.com$request_uri;
    }

    if ($host = asia-power.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name asia-power.com www.asia-power.com;
    return 404;
}

server {
    if ($host = www.aspowe.com) {
        return 301 https://$host$request_uri;
    }

    if ($host = aspowe.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name aspowe.com www.aspowe.com;
    return 404;
}
