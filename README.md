# 3D Snake Game

A real-time multiplayer 3D snake game built with Socket.io, Three.js, and Prisma.

## Prerequisites

- Node.js (v18 or higher)
- npm
- PostgreSQL database (or use Prisma Postgres)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Create a `.env` file in the root directory with the database connection:

```env
DATABASE_URL="database-url-here"
```

During development, this a local database with Prisma PostgreSQL can be set up with the following:

```bash
npx prisma dev
```

### 3. Run Prisma Migrations

Generate the database schema and create tables:

```bash
npx prisma migrate dev
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Start the Development Server

```bash
npm run dev
```

## Project Structure

```
├── src/
│   ├── controllers/      # Socket.io event handlers
│   ├── services/         # Game logic and matchmaking
│   ├── types/            # TypeScript type definitions
│   └── server.ts         # Express and Socket.io server
├── public/               # Frontend HTML/JS
├── prisma/               # Database schema
└── package.json
```