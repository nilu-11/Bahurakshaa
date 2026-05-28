# HEC-RAS Justification Note (For Supervisor)

## Why HEC-RAS was included
HEC-RAS is included to provide a physics-based hydraulic layer in addition to ML risk probabilities.
The ML model estimates event likelihood (flood/landslide probability), while hydraulic simulation explains how water may propagate through the river corridor.

## Purpose in this project
1. Convert rainfall/runoff conditions into hydraulic behavior indicators:
- water level/depth
- flow velocity
- downstream arrival time

2. Support preparedness decisions with scenario-style interpretation:
- where risk may intensify first
- how quickly downstream reaches can be affected

3. Improve explainability for non-ML stakeholders:
- agencies can see physically meaningful signals, not only probabilistic outputs

## How it works in current prototype
Current implementation is a **HEC-RAS-ready digital twin simulation layer**, not a calibrated engineering HEC-RAS model run.

Implementation details:
1. Frontend computes synthetic routing using Manning-based approximations.
2. Inputs include current rainfall context and predefined channel cross-section assumptions.
3. Output stations show projected depth, velocity, relative warning/danger status, and travel-time estimate.
4. These signals are used as contextual decision support in monitoring/alerts.

## What it is and is not
It is:
- a decision-support simulation layer for preparedness UX
- a bridge to future calibrated hydraulic integration

It is not yet:
- a surveyed, calibrated, regulatory-grade HEC-RAS deployment
- a direct replacement for full hydrodynamic model calibration workflow

## Roadmap to full operational HEC-RAS
1. Import surveyed cross-sections and validated boundary conditions.
2. Calibrate against observed gauge hydrographs and historical events.
3. Ingest exported HEC-RAS CSV outputs via the established schema contract.
4. Replace synthetic routing values with calibrated model outputs in UI.
