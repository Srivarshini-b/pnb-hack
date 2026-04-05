# QScan - Post-Quantum Cryptography Dashboard

This repository contains the full source code for the QScan backend, frontend, and Post-Quantum OpenSSL cryptography environment. It is fully containerized with Docker for easy execution across different machines.

## Prerequisites

To run this application, you must have **Docker Desktop** installed and running on your machine.

**If you do not have Docker Desktop installed:**
1. Download Docker Desktop from the official website: [Docker Desktop Download](https://www.docker.com/products/docker-desktop/)
2. Run the installer and follow the on-screen instructions.
3. Open the **Docker Desktop** application from your Start Menu/Applications folder and wait for the Engine to start (you will see a green icon indicating it is running).

## Getting Started

Follow these steps to build and launch the application:

### 1. Clone the Repository
Open a terminal (such as PowerShell, Command Prompt, or Git Bash) and run:
```bash
git clone <your-repository-url>
```
*(Replace `<your-repository-url>` with the actual URL of this repository).*

### 2. Navigate to the App Directory
Change your directory into the main application folder:
```bash
cd PNB-ananya
```

### 3. Build and Run the Containers
Ensure your Docker Desktop application is open and running in the background. Then, execute the following command:
```bash
docker compose up --build
```

**Note:** The initial build process may take several minutes as it specifically compiles the bleeding-edge `OpenSSL 3.6` master branch alongside `liboqs` and `oqs-provider` directly from source to enforce quantum-safe ciphers.

### 4. Access the Application
Once the terminal indicates that the backend and frontend are ready (e.g., `Server running on port 5001`), you can open your web browser and navigate to:

- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend API Server:** [http://localhost:5001](http://localhost:5001)

### Optional: Stopping the Server
To shut down the application, return to the terminal where Docker is running and press `Ctrl + C`. You can also manage the containers directly through the Docker Desktop App UI.
