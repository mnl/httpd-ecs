# httpd-ecs
Container image of [Apache HTTPD](https://httpd.apache.org/docs/2.4/) with minimal config for static hosting and logging in [elastic common schema](https://www.elastic.co/guide/en/ecs/8.11/ecs-field-reference.html).

## Usage:
Run in forground to inspect operation:
```bash
$ podman run --replace --rm --name httpd -t -p 8080:8080 ghcr.io/mnl/httpd-ecs:v0.1.0
```
You should see apache httpd log output in structured json log, one object per line.
- CustomLog is printed to standard out.
- ErrorLog is printed on standard error.

Mount a directory with static files to `/usr/local/apache2/htdocs` to replace the placeholder content.

Example output (pretty printed):
```JSON
{
  "@timestamp": "2016-05-23 08:05:30.365134 +0000",
  "ecs.version": "8.11.0",
  "event.dataset": "apache.error",
  "log.level": "notice",
  "log.logger": "mpm_event",
  "process.pid": 1,
  "process.thread.id": 140609060379616,
  "error.code": "AH00489",
  "error.file": "event.c(3321)",
  "server.address": "box",
  "message": "Apache/2.4.65 (Unix) configured -- resuming normal operations"
}
{
  "@timestamp": "2016-05-23 08:05:30.365215 +0000",
  "ecs.version": "8.11.0",
  "event.dataset": "apache.error",
  "log.level": "notice",
  "log.logger": "core",
  "process.pid": 1,
  "process.thread.id": 140609060379616,
  "error.code": "AH00094",
  "error.file": "log.c(1598)",
  "server.address": "box",
  "message": "Command line: 'httpd -D FOREGROUND -f /etc/apache2/httpd.conf'"
}
{
  "@timestamp": "2016-05-23 08:05:34.315929 +0000",
  "ecs.version": "8.11.0",
  "event.dataset": "apache.access",
  "http.request.method": "GET",
  "url.path": "/index.html",
  "url.original": "/index.html",
  "http.version": "HTTP/1.1",
  "client.ip": "fd7c:9a08:cafe:7447:ea6a:64ff:fe38:c0de",
  "server.address": "box",
  "http.response.status_code": 200,
  "http.request.bytes": 78,
  "http.response.bytes": 282,
  "user_agent.original":"evil \\\\\\\"hax"
}
```

## Security
Published images are signed. Verify with [cosign](https://docs.sigstore.dev/cosign/verifying/verify/#keyless-verification-using-openid-connect):
```bash
cosign verify \
  --certificate-identity-regexp 'https://github\.com/mnl/httpd-ecs/.*' \
  --certificate-oidc-issuer-regexp 'https://token.actions.githubusercontent.com' \
  --output text ghcr.io/mnl/httpd-ecs
```
