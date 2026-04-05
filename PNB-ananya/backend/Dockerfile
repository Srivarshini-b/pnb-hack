FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install core build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    ninja-build \
    python3 \
    python3-pip \
    whois \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Build OpenSSL (master branch for 3.6+ dev)
RUN git clone --depth 1 https://github.com/openssl/openssl.git && \
    cd openssl && \
    ./config --prefix=/opt/openssl && \
    make -j$(nproc) && \
    make install_sw && \
    cd .. && rm -rf openssl

# Set environment variables for custom OpenSSL
ENV PATH="/opt/openssl/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/openssl/lib64:/opt/openssl/lib:${LD_LIBRARY_PATH}"

# Build liboqs
RUN git clone -b main https://github.com/open-quantum-safe/liboqs.git && \
    cd liboqs && \
    mkdir build && cd build && \
    cmake -GNinja \
          -DOQS_USE_OPENSSL=ON \
          -DOPENSSL_ROOT_DIR=/opt/openssl \
          -DOPENSSL_INCLUDE_DIR=/opt/openssl/include \
          -DOPENSSL_CRYPTO_LIBRARY=/opt/openssl/lib64/libcrypto.so \
          -DOPENSSL_SSL_LIBRARY=/opt/openssl/lib64/libssl.so \
          -DCMAKE_INSTALL_PREFIX=/opt/liboqs .. && \
    ninja && \
    ninja install && \
    cd ../.. && rm -rf liboqs

# Build oqs-provider
RUN git clone -b main https://github.com/open-quantum-safe/oqs-provider.git && \
    cd oqs-provider && \
    cmake -DOPENSSL_ROOT_DIR=/opt/openssl \
          -DOPENSSL_INCLUDE_DIR=/opt/openssl/include \
          -DOPENSSL_CRYPTO_LIBRARY=/opt/openssl/lib64/libcrypto.so \
          -DOPENSSL_SSL_LIBRARY=/opt/openssl/lib64/libssl.so \
          -Dliboqs_DIR=/opt/liboqs/lib/cmake/liboqs \
          -DCMAKE_INSTALL_PREFIX=/opt/oqsprovider \
          -B build . && \
    cmake --build build && \
    cmake --install build && \
    # Manually copy to OpenSSL module directory to be safe
    MODULES_DIR=$(/opt/openssl/bin/openssl version -m | awk '{print $NF}' | tr -d '"') && \
    mkdir -p "$MODULES_DIR" && \
    cp build/lib/oqsprovider.so "$MODULES_DIR/" || true && \
    cd .. && rm -rf oqs-provider


WORKDIR /app

# Install Python dependencies
RUN pip3 install requests certifi

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Expose backend port (assuming 5000 based on standard Express/Node setups, adjust if necessary)
EXPOSE 5000

CMD ["npm", "start"]
