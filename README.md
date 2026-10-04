# CapiLAR – Frontend

Frontend web application for CapiLAR, a platform for the operational and technical management of hair salons and professional stylists.

Final project of the Tecnicatura Universitaria en Desarrollo Web – Facultad de Informática, Universidad Nacional del Comahue (2026).

**Team: LAR Developers**
* Crespillo, Andrea
* Navarrete, Ramiro Rafael
* Parra Sanhueza, Linda Cristal

## About the project

Salons usually lack traceability of chemical treatments, accurate cost control of supplies, flexible recurring appointments, and objective hair diagnosis. CapiLAR addresses these problems with the following modules:

| Module | Description |
| :--- | :--- |
| **Scheduling & Appointments** | Availability based on service duration and professional schedules, single and recurring appointments, WhatsApp reminders to clients and a daily email agenda for professionals. |
| **Technical Records & Treatment History** | Digital record of each treatment: colorimetry formulas, oxidant volumes, pose times, diagnostics and an evolutionary photo log. |
| **Inventory Management** | Automatic stock deduction from the technical record, QR-based stock in/out, suppliers and delivery notes, low-stock alerts. |
| **AI Hair Diagnosis Engine** | Assessment of damage level, porosity and previous chemical work to recommend services, home-care products and incompatibility alerts. |

The project is developed with real hair professionals as test users, who provide feedback on requirements and screens.

## Tech stack

| Layer | Technology |
| :--- | :--- |
| **Runtime / Build Tool** | Node.js, Vite |
| **Library / Language** | React, TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Routing** | React Router DOM |

## Repositories

CapiLAR is split into separate repositories:
* **Backend:** NestJS + Prisma + MySQL
* **Frontend (this repository):** Vite + React + Tailwind CSS
* **Mobile:** React Native + Expo

## Getting started

### Prerequisites

* Node.js LTS (20.x or higher) and npm
* Git

### Installation

```bash
git clone <repository-url>
cd <repository-folder>
npm install
```

### Environment variables

Copy `.env.example` to `.env` in the project root and adjust the values if needed (`.env` is git-ignored and must never be committed):

```bash
cp .env.example .env
```

For Vite, custom variables must be prefixed with `VITE_`:

```env
VITE_API_URL="http://localhost:3000"
```

## Running the app

```bash
# development (watch mode with HMR)
npm run dev

# production build
npm run build

# preview production build locally
npm run preview
```

The web application runs on `http://localhost:5173` by default.

## Project structure

* `src/components/` - Reusable UI elements (e.g., buttons, inputs) and layout components (e.g., Header).
* `src/pages/` - Main route components (Landing, Dashboard, etc.).
* `src/customHooks/` - Custom React hooks for shared logic.
* `src/assets/` - Static assets like images and global styles.

## Git workflow

* `main`: stable, deliverable versions. Protected: changes only arrive through a Pull Request.
* `develop`: day-to-day integration branch. Default branch of the repository.
* Feature branches are created from `develop`, one per Linear issue, using the branch name suggested by Linear (e.g. `username/pwa-165-implement-authentication`).
* Pull Requests target `develop`. Include `Closes PWA-XXX` in the description so the Linear issue is closed automatically on merge.
* When a set of features is ready to be delivered, `develop` is merged into `main` through a Pull Request.

## Commit convention

Commits are written in English following Conventional Commits:
* `- Feat: add user registration form`
* `- Fix: resolve responsive layout on mobile`
* `- Chore: update dependencies or setup`
* `- Docs: update README`

## Project management

Tasks are organized in Linear (team PWA LAR, project CapiLAR) as milestones (epics) with issues and checklists:
* Core Setup & User Management
* Scheduling & Appointments
* Technical Records & Treatment History
* Inventory Management
* AI Hair Diagnosis Engine
* Mobile App
* Deployment & Environments

## Status

🚧 In development.

*Trabajo Final 2026 – Tecnicatura Universitaria en Desarrollo Web – Facultad de Informática – Universidad Nacional del Comahue*