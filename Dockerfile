FROM cgr.dev/chainguard/wolfi-base:latest@sha256:d68b2b10db0ddb2c6d9cb3a7720ecab5ca19b4b430fd592cd07c23d7da971b56 AS base

# jq for log2ecs, coreutils for "env -S"
# Upgrade base to fix patched vulnerabilities
RUN apk upgrade --no-cache && \
    apk add --no-cache \
	apache2=~2.4 \
	coreutils=~9.7 \
	jq=~1.8 \
	;

COPY alog2ecs elog2ecs  /usr/local/bin/

# www-data in apache image
USER 82:82

COPY apache-httpd-static.conf /etc/apache2/httpd.conf
# Minimal config for static hosting and ECS logging

# Matches httpd.conf value
EXPOSE 8080

# Unobtrusive entrypoint
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["httpd"]

# Static files to serve
COPY htdocs /htdocs

