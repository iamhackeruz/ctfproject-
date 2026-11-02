FROM alpine:3.23

# Install minimal, safe tooling for cybersecurity practice
RUN apk update && \
    apk add --no-cache \
        bash \
        coreutils \
        grep \
        sed \
        gawk \
        findutils \
        python3 \
        tar \
        file \
        which && \
    rm -rf /var/cache/apk/*

# Create dedicated non-root student user (UID: 10001, GID: 10001)
RUN addgroup -g 10001 student && \
    adduser -u 10001 -G student -s /bin/bash -D -h /home/student student && \
    chmod 750 /home/student

# Switch to non-root student
USER 10001:10001
WORKDIR /home/student

# Set environment
ENV HOME=/home/student \
    USER=student \
    TERM=xterm-256color \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Keep container alive to receive `docker exec` commands
CMD ["sleep", "infinity"]
