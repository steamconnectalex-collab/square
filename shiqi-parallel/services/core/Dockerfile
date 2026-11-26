FROM rust:1-bookworm AS builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 --create-home shiqi
WORKDIR /app
COPY --from=builder /app/target/release/shiqi-core /usr/local/bin/shiqi-core
USER shiqi
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/shiqi-core"]
