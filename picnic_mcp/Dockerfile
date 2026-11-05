# Built on the official Home Assistant base image (Alpine + s6-overlay + bashio).
# BUILD_FROM is supplied by the Supervisor from build.yaml.
ARG BUILD_FROM

# ---------------------------------------------------------------------------
# Build stage: fetch upstream mcp-picnic at a pinned commit and bundle this
# add-on's gateway together with upstream's TypeScript sources into a single
# self-contained file. The gateway imports upstream's tool registry, MCP
# handlers and Picnic client directly (see app/gateway.mjs for why), which is
# why this is a bundle rather than `npm install mcp-picnic`: the published
# package only ships upstream's own CLI entry point.
# ---------------------------------------------------------------------------
FROM ${BUILD_FROM} AS build

# Bump together with the CHANGELOG; re-check TOOL_GROUPS in app/gateway.mjs
# against upstream's src/tools/picnic-tools.ts when you do.
ARG MCP_PICNIC_REPO=https://github.com/ivo-toby/mcp-picnic.git
ARG MCP_PICNIC_COMMIT=d235da4325f94c5e9b6284dc4324281159179127

RUN apk add --no-cache nodejs npm git

WORKDIR /build/upstream
RUN git init -q \
    && git remote add origin "${MCP_PICNIC_REPO}" \
    && git fetch -q --depth 1 origin "${MCP_PICNIC_COMMIT}" \
    && git checkout -q FETCH_HEAD \
    # --ignore-scripts: upstream's "prepare" builds its own CLI bundle, which
    # isn't used here. Dev dependencies stay: esbuild is one of them.
    && npm ci --ignore-scripts --no-audit --no-fund

# Inside the upstream tree so `../src/...` and node_modules resolve.
COPY app/ /build/upstream/addon/
RUN npx esbuild addon/gateway.mjs \
      --bundle --platform=node --format=esm --target=node22 \
      --outfile=/build/out/gateway.mjs \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
    && cp LICENSE /build/out/LICENSE.mcp-picnic

# ---------------------------------------------------------------------------
# Runtime stage: Node plus the bundle; no npm, git or node_modules.
# ---------------------------------------------------------------------------
FROM ${BUILD_FROM}

# jq: run.sh merges the generated bearer token into options.json before
# writing it back through the Supervisor API.
RUN apk add --no-cache nodejs jq python3

COPY --from=build /build/out/ /app/
# Served as the favicon and sent to MCP clients as serverInfo.icons.
COPY icon.png /app/icon.png
COPY run.sh /run.sh
COPY remote_setup.py /app/remote_setup.py
COPY remote_component/ /opt/remote_component/
RUN chmod a+x /run.sh

EXPOSE 8097 8096
CMD [ "/run.sh" ]
