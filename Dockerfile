FROM docker.io/httpd:2.4-alpine3.22@sha256:9a5e765c2ea150d2547f74dd2bbf5e96b14ddc540a0c333ba5054c0e9961fb95 AS base

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
