# Frontend (Standalone)

This is the extracted React frontend for Bahurakshaa.

## Run

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Start backend in project root (separate terminal):

```bash
cd /home/nili/Desktop/Bahurakshaa
./venv/bin/uvicorn api.main:app --reload --port 8000
```

4. Start frontend:

```bash
cd /home/nili/Desktop/Bahurakshaa/frontend
npm run dev
```

App URL: `http://localhost:8080`

## Notes

- Live risk data is fetched from `VITE_HAZARD_API_BASE` (`/risk/zones/live`).
- If live API is unavailable, dashboard components fall back to local composite logic.
- Legacy backup remains in `Bahuraksha/` until you decide to delete it.
