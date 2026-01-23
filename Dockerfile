FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0c79f2ee04e77203c3bc487ef237faac05e99ffbc05d67a1c53e86ba58100f37 AS base

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

