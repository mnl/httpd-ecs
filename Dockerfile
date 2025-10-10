FROM docker.io/httpd:2.4-alpine3.22@sha256:07b2fabb7029a0b8aeb2e0fd02651c28fe22c21c5b5a59d6ff5b022791fcd89e AS base

# jq for log2ecs, coreutils for "env -S"
RUN apk add \
	coreutils=~9.7 \
	jq=~1.8 \
	;

# Fix "citical" CVE
RUN apk upgrade \
	'libxml2>2.13.9*'

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
COPY htdocs /usr/local/apache2/htdocs

