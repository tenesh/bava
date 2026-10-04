# The browser tests' container: the test browser's own image, pinned to the
# version in frontend/package.json, so a screenshot taken on the user's Mac
# matches one taken on CI pixel for pixel. Built with frontend/ as context.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /repo/frontend
# The packages, installed for Linux inside the image; the run mounts them over
# the repo's own node_modules so the two never mix.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
