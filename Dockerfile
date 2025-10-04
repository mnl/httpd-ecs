FROM docker.io/httpd:2.4-alpine3.22@sha256:dad81abbbcfeb58602b5ac4e11c4336d04db48ea1d69b038185191fb363012be AS base

# jq for log2ecs, coreutils for "env -S"
RUN apk add \
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
COPY htdocs /usr/local/apache2/htdocs

