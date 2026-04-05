# QScan: Quantum-Safe Communication Capability Scanner

This project contains the codebase for the QScan Dashboard. 
Since `npm` and `node` might not have been available during the initial setup, please follow these instructions to start the servers.

## Prerequisites
You need Node.js, npm, and MongoDB installed on your system.
If you don't have Node.js and npm installed, run:
```bash
sudo apt update
sudo apt install -y nodejs npm
```

If you don't have MongoDB installed, install and start it:
```bash
sudo apt install -y mongodb
sudo systemctl start mongodb
```

## 1. Start the Backend Server

The backend is an Node.js/Express server that connects to MongoDB and runs the Python `scanner.py` script.

Open a terminal and navigate to the `backend` directory:
```bash
cd /home/lokesh/Desktop/PNB/backend
```

Install dependencies:
```bash
npm install
```

Start the server:
```bash
npm start
```
The backend API will run on `http://localhost:5000`.

## 2. Start the Frontend Dashboard

The frontend is a React application built with Vite and Tailwind CSS.

Open a new terminal and navigate to the `frontend` directory:
```bash
cd /home/lokesh/Desktop/PNB/frontend
```

Install dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```

The frontend will be accessible at `http://localhost:5173`. Open this URL in your browser to view the QScan Dashboard.

## Features Included
- **Dark Theme Analytics Dashboard**: Modeled after the reference image with neon glow effects and glassmorphism panels.
- **Python Scanner Integration**: The backend uses `child_process.exec` to run `scanner.py`, parsing its JSON output.
- **Data Persistence**: Scan results are stored in MongoDB using Mongoose with calculated `securityScore` and `pqcReadinessLabel`.
- **Visualizations**: Includes Pie charts for grouped algorithms and Bar charts for overall risk posture.
