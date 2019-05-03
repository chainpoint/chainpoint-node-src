# Node.js 8.x LTS on Debian Stretch Linux
# see: https://github.com/nodejs/LTS
# see: https://hub.docker.com/_/node/
FROM node:8.11.3-stretch

LABEL MAINTAINER="Jacob Henderson <jacob@tierion.com>"

# gosu : https://github.com/tianon/gosu
RUN apt-get update && apt-get install -y git gosu

# The `node` user and its home dir is provided by
# the base image. Create a subdir where app code lives.
RUN mkdir /home/node/app
RUN mkdir /home/node/app/ui

# Copy Build Artifacts Node Stats UI
COPY ./ui/build /home/node/app/ui

WORKDIR /home/node/app

ENV NODE_ENV production

COPY package.json yarn.lock server.js /home/node/app/
RUN yarn

RUN mkdir -p /home/node/app/lib
COPY ./lib/*.js /home/node/app/lib/

RUN mkdir -p /home/node/app/lib/endpoints
COPY ./lib/endpoints/*.js /home/node/app/lib/endpoints/

RUN mkdir -p /home/node/app/lib/models
COPY ./lib/models/*.js /home/node/app/lib/models/

RUN mkdir -p /home/node/app/artifacts
COPY artifacts /home/node/app/artifacts

ADD cli /home/node/app/cli

RUN mkdir -p /home/node/app/.data/rocksdb

EXPOSE 80

CMD ["/bin/bash", "-c", "/home/node/app/cli/run.sh"]
