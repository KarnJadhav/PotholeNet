# PotholeNet

PotholeNet is a community-driven road hazard intelligence platform built with the MERN stack, OpenStreetMap, real-time GPS tracking, and machine learning.

The MVP lets users view an OSM map, search and route between places, report detected potholes with device coordinates, store clustered reports in MongoDB, and receive warnings when travelling near known hazards.

## Stack

- Frontend: React, Vite, Leaflet, React Leaflet, Socket.IO client
- Backend: Node.js, Express, MongoDB, Mongoose, Socket.IO
- ML service: Python FastAPI placeholder for YOLO/OpenCV inference
- Maps: OpenStreetMap tiles and OSRM public routing endpoint

## Project Structure

```text
frontend/    React map, camera/report UI, route warning client
backend/     Express API, MongoDB pothole schema, clustering, realtime events
ml-service/  FastAPI inference API stub for future YOLO model integration
```

## Run Locally

1. Install Node dependencies:

```bash
npm install
npm run install:all
```

2. Create backend environment:

```bash
copy backend\.env.example backend\.env
```

3. Start MongoDB locally, or set `MONGO_URI` in `backend/.env`.

If MongoDB is not running, the backend starts with in-memory development storage so the demo still works. Data saved in that mode resets when the backend stops.

With Docker Desktop running, you can start MongoDB with:

```bash
docker compose up -d mongo
```

4. Start the MERN app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend API: `http://localhost:5000`

## ML Service

The ML service currently returns a simulated pothole detection so the full app flow can be tested before a model is trained.

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Later, replace the placeholder detector in `ml-service/app/detector.py` with YOLO inference.

## MVP Features

- OpenStreetMap-based map
- Current GPS location tracking
- Place search using Nominatim
- Route drawing using OSRM
- Pothole reports with latitude, longitude, confidence, severity, and optional image
- Duplicate clustering within a configurable radius
- Community votes: still exists, fixed, dangerous
- Live map updates via Socket.IO
- Nearby warning banner and voice alert
