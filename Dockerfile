FROM cgr.dev/chainguard/wolfi-base:latest@sha256:1d95114038f76513a9ace6fca107d5582b08c65981f81f61cb56bf7fd2ef216d AS base

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

