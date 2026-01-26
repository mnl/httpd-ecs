FROM cgr.dev/chainguard/wolfi-base:latest@sha256:9d9881ff9de0b66fb58bc98f5531c710f1b24d84c18d5751700e11b68c5e2d6c AS base

# jq for log2ecs, coreutils for "env -S"
RUN apk add \
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

