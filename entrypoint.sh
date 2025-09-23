#!/usr/bin/env sh

if [ "$1" != "httpd" ]
then
	exec "$@"
fi

APACHE_CONFIG=${APACHE_CONFIG:-/etc/apache2/httpd.conf}

if [ ! -r "${APACHE_CONFIG}" ]
then
	printf "Error: %s %s\n" "Could not read file" "$APACHE_CONFIG" 1>&2
	exit 1
fi

exec httpd -D FOREGROUND -f "${APACHE_CONFIG}"
