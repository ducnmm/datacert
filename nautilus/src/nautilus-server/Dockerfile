# Build stage - use nightly for edition2024 support
FROM rustlang/rust:nightly as builder

WORKDIR /app

# Copy Cargo files
COPY Cargo.toml ./

# Copy source code
COPY src ./src

# Build the application with ai-trust-oracle feature
RUN cargo build --release --features ai-trust-oracle

# Runtime stage
FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary from builder stage
COPY --from=builder /app/target/release/nautilus-server /app/nautilus-server

# Expose port 8080
EXPOSE 8080

# Run the server
CMD ["/app/nautilus-server"]
