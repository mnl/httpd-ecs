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

Some fields are modified fo prevent breaking JSON. Note that this method isn't 100% foolproof.

Example output (pretty printed):
```JSON
{
  "ecs.version": "8.11.0",
  "event.dataset": "apache.error",
  "log.level": "notice",
  "process.pid": 1,
  "process.thread.id": 140116034288608,
  "server.address": "box",
  "error.file": "event.c(3321)",
  "message": "AH00489: Apache/2.4.65 (Unix) configured -- resuming normal operations"
}
{
  "ecs.version": "8.11.0",
  "event.dataset": "apache.error",
  "log.level": "notice",
  "process.pid": 1,
  "process.thread.id": 140116034288608,
  "server.address": "box",
  "error.file": "log.c(1598)",
  "message": "AH00094: Command line: 'httpd -D FOREGROUND -f /etc/apache2/httpd.conf'"
}
```
