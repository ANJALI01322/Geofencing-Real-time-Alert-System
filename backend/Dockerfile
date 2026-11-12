# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy module file (go.sum generated inside Docker if missing)
COPY go.mod ./
RUN go mod download && go mod tidy || true

# Copy source
COPY . .

# Regenerate go.sum from actual source, then build
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o geotrack .

# ─── Stage 2: Run ────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/geotrack .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["./geotrack"]
