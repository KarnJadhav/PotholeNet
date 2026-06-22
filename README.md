# PotholeNet
<<<<<<< HEAD

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

The ML service can run a YOLO model when a trained model file exists at `ml-service/models/pothole-yolov8n.pt`. If no model file is present, it returns a simulated pothole detection so the full app flow can be tested before training is complete.

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

To use a custom model path:

```bash
set YOLO_MODEL_PATH=models\best.pt
uvicorn app.main:app --reload --port 8000
```

The frontend `Detect` button opens the device camera or image picker, sends the image to the ML service, and saves the pothole with current GPS coordinates when a pothole is detected.

## Route Risk Analysis

After a route is generated, the frontend checks known potholes within 20 meters of the route and calculates a risk score from hazard count, severity, and route distance:

- Safe: low risk
- Moderate: medium risk
- Dangerous: high risk

## Automatic Driving Mode

The `Drive` control starts camera-based driving mode:

```text
Camera stream
  -> capture frame every 2 seconds
  -> send frame to ML service
  -> confidence threshold check
  -> auto-save report with GPS coordinates
```

Automatic reports are stored with `source: "driving_mode"` and include detection `area`, `confidence`, `severity`, and backend `riskScore`.

## Heatmap and Admin Dashboard

The `Heat` control overlays a Leaflet heatmap where lower-risk hazards trend green, moderate hazards trend yellow, and high-risk hazards trend red.

The `Admin` tab shows city operations metrics:

- Active hazards
- New reports today
- Severe hazards
- Repair queue count
- Highest-risk road segments

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
=======
An AI-powered road intelligence platform built with MERN Stack, OpenStreetMap, and Computer Vision. RoadPulse AI detects potholes through user cameras, stores geotagged road hazard data, and delivers real-time navigation alerts to help drivers avoid unsafe roads.
>>>>>>> 32eafdde82322771ed7e29b3954740d5c1e4f80e
