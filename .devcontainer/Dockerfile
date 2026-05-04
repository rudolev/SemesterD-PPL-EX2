# Use the official Node 24 Alpine image
FROM node:24-alpine

# Install Racket and dependencies
# 'racket' is available in the Alpine edge/community repositories
RUN apk add --no-cache \
    racket \
    bash \
    git \
    openssh

# Set the default shell to bash (optional but usually preferred for devcontainers)
ENV SHELL=/bin/bash

# Ensure the 'node' user has appropriate permissions
USER node