# SportsLock Project Architecture & Agent Directives

## Project Overview
SportsLock is a sports betting analytics and prediction web application deployed via Vercel. The system synthesizes live odds, probability outcomes, and point spreads (optimized for Hard Rock sportsbook analytics) with contextual external data, such as official referee and umpire assignments across the NFL, MLB, NHL, NBA, college football, and college basketball.

## Core Technical Components
*   **Parlay Calculation Engine:** The algorithmic core handling multi-leg probability outcomes, run lines, and odds math.
*   **Screenshot OCR Parsing:** The ingest pipeline that extracts structured text from bet slips, ticket analysis screenshots, and external sportsbook visuals.
*   **Predictive Models:** The integration layer merging historical umpire/referee tendencies with live odds feeds.

## Agent Reconnaissance Instructions
1.  **Read-Only Phase:** Do not write or modify any code yet. 
2.  **Dependency Scan:** Read `package.json` and configuration files to identify the current framework, OCR libraries, and build tools.
3.  **Component Mapping:** Locate the specific directories housing the parlay algorithms and the OCR parsing logic.
4.  **Deployment Verification:** Review the Vercel configuration to ensure any proposed architectural changes align with the existing CI/CD pipeline.

## Execution Protocol
*   Stop and wait for user approval after completing the reconnaissance phase.
*   Before modifying the parlay engine or OCR ingestion scripts, generate a brief step-by-step logic proposal.
*   Request manual permission before executing any destructive terminal commands or installing new dependencies.
