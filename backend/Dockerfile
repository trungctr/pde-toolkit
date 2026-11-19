# syntax=docker/dockerfile:1
# Ảnh chạy máy chủ + giao diện ChillCat Studio. Build từ GỐC repo:
#   docker build -f backend/Dockerfile -t chillcat-studio .
#   docker run -p 8080:8080 -e MONGODB_URI="mongodb+srv://…" -e JWT_SECRET="…" -e PUBLIC_BASE_URL="https://…" chillcat-studio
# Chạy kèm MongoDB trên một máy: xem backend/deploy/docker-compose.yml.

FROM rust:1-bookworm AS build
WORKDIR /src
COPY backend/ backend/
# mẫu tài liệu được nhúng vào binary lúc biên dịch (include_str!)
COPY templates/ templates/
# Máy ít RAM (Docker Desktop < 4 GB): --build-arg CARGO_BUILD_JOBS=2 để giảm số rustc chạy song song.
ARG CARGO_BUILD_JOBS
# Cache registry và thư mục target giữa các lần build (BuildKit): sửa mã chỉ biên dịch lại crate đổi.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/src/backend/target \
    cargo build --release --locked ${CARGO_BUILD_JOBS:+--jobs $CARGO_BUILD_JOBS} --manifest-path backend/Cargo.toml -p chillcat-server \
 && cp backend/target/release/chillcat-server /usr/local/bin/chillcat-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 chillcat
WORKDIR /app
COPY --from=build /usr/local/bin/chillcat-server /app/chillcat-server
# giao diện tĩnh (không kèm backend/)
COPY index.html manifest.webmanifest sw.js robots.txt sitemap.xml llms.txt og-image.png /app/web/
COPY css/ /app/web/css/
COPY js/ /app/web/js/
COPY icons/ /app/web/icons/
COPY templates/ /app/web/templates/
ENV APP_ENV=prod \
    HTTP_ADDR=0.0.0.0:8080 \
    STATIC_DIR=/app/web \
    LOG_FORMAT=json \
    TZ=Asia/Ho_Chi_Minh
USER chillcat
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["/bin/bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /healthz HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q ok <&3"]
CMD ["/app/chillcat-server"]
