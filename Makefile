#!/usr/bin/env make

name := httpd-ecs
tag ?= latest
port ?= 8030

.PHONY: lint clean build test all wipe

podman-host-ok:
	# Ensure that podman can build and run containers
	echo from scratch | podman build -qt $(name)-pause -
	podman run --replace --detach --rm \
		--name $(name)-pause --init localhost/$(name)-pause /run/podman-init -P
	podman stop $(name)-pause
	podman rmi $(name)-pause
	touch podman-host-ok

lint: build
	# Syntaxcheck httpd config
	podman run -v $(PWD)/apache-httpd-static.conf:/test.conf:ro,z \
		--entrypoint='' --rm $(name):$(tag) httpd -t -f /test.conf

test: build
	# Verify request returns 200 (first is expected to fail (during startup))
	podman run --replace --rm -it --name $(name)-webtest \
		-p $(port):8080 $(name):$(tag) &
	curl --retry 5 --retry-delay 1 --retry-connrefused \
		--silent --show-error --head --fail \
		--user-agent 'escape \"this\"' \
		http://localhost:$(port)/
	podman stop $(name)-webtest

Dockerfile: podman-host-ok
	buildah bud --layers -f $@ \
		--annotation=org.opencontainers.image.version="$(tag)" \
		--annotation=org.opencontainers.image.revision="$(shell git rev-parse --short HEAD)" \
		--created-annotation \
		--tag $(name):$(tag)

clean:
	podman rmi -i $(name):$(tag)

wipe: clean
	$(RM) podman-host-ok

build: Dockerfile

all: clean build
