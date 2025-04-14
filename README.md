# Phaigo - Payments Made Simple

Phaigo is a application for PYSUD Payments. It allows users to:

- Create personal profiles with custom usernames
- Send PYUSD to any user via their username
- Use an AI assistant to send transcations in a super simple manner.
- Request Payments from others
- View transaction history
- Generate payment links to share with others
- Explore PYUSD analytics.

![Phaigo Banner](public/banner.png)

## PayPal x Google Cloud Web3

Phaigo is developed specifically for the PayPal x Google Cloud Web3 Challenge, focusing on the theme: "Develop a solution that enables PYUSD transactions and connects to the GCP's Blockchain RPC Service."

Key compliance points:

- **PYUSD Integration:** The core functionality revolves around sending, receiving, and managing PYUSD stablecoin via a user-friendly interface.
- **GCP Blockchain RPC Utilization:** Google Cloud's Blockchain RPC service is used for all on-chain interactions, providing reliability, scalability, and access to advanced methods for analytics.

### Leveraging Computationally Expensive Methods

A key requirement of the hackathon is demonstrating the effective use of GCP's free computationally expensive RPC methods. Phaigo utilizes these for its **Deep Dive** analytics features:

- **Methods Used:** `debug_traceTransaction`, `trace_block`.
- **Purpose:** To provide detailed, granular execution traces of specific PYUSD transactions and blocks, enabling deeper analysis beyond standard transaction data.
- **Implementation:**
  - **Frontend UI:** Users select trace methods and input parameters in the Deep Dive tab ([`src/components/analytics/Analytics.tsx`](src/components/analytics/Analytics.tsx)).
  - **Backend API:** Secure API routes handle the requests and interact with GCP:
    - Transaction Tracing: [`src/app/api/blockchain/transaction/trace/route.ts`](src/app/api/blockchain/transaction/trace/route.ts)
    - Block Tracing: [`src/app/api/blockchain/block/trace/route.ts`](src/app/api/blockchain/block/trace/route.ts)
  - **Service Logic:** Core RPC call logic resides in [`src/lib/services/blockchain/analytics.ts`](src/lib/services/blockchain/analytics.ts).

Showcasing the unique advantages of the GCP RPC service.

## Tech Stack

- **Frontend:** Next.js 15.3, React 19, TailwindCSS v4
- **Backend:** Next.js API Routes, PostgreSQL, Prisma ORM 6.6
- **Blockchain:** Ethereum (Mainnet and Sepolia testnet), PYUSD ERC-20 token
- **Authentication:** Wallet-based authentication with Web3Modal
- **UI Components:** Shadcn UI components, TailwindCSS v4, tw-animate-css and tailwindcss-motion for animations
- **Testing:** Vitest 3.1.1 with @testing-library for unit and component tests

## Architecture

Phaigo uses an onchain-synced database as a single source of truth. This means:

1. All blockchain transactions are first recorded in the database with a "PENDING" status
2. Once the transaction is confirmed on the blockchain, the database record is updated to "COMPLETED"
3. If the transaction fails, the database record is updated to "FAILED"

This approach provides several benefits:
- Immediate user feedback while waiting for blockchain confirmations
- Reliable transaction history regardless of blockchain reorgs
- Single source of truth for application state
- Simplified frontend state management

## Getting Started

### For Development

- Docker (for PostgreSQL database)
- Ethereum wallet (MetaMask, Coinbase Wallet, WalletConnect, etc.)

## Database

- **User:** Stores user profiles with usernames and wallet addresses
- **Payment:** Records of PYUSD transfers between users
- **Request:** Payment requests created by users

## Features

- **User Profiles:** Create a unique username that others can use to send you payments
- **PYUSD Transfers:** Send PYUSD to any user on the platform using their username, and even the possibility to use AI in order to do so.
![Phaigo Chat](public/chat.png)

- **Payment Requests:** Request PYUSD from others with optional notes and expiration dates
- **Transaction History:** View your sent and received payments
- **Payment Links:** Generate shareable payment links

## Analytics Dashboard

Phaigo includes a comprehensive Analytics Dashboard powered by Google Cloud's Blockchain RPC service, offering deep insights into PYUSD activity:

- **Overview:** High-level statistics and metrics for PYUSD.
- **Transactions:** Detailed analysis of PYUSD transaction volume, frequency, and patterns.
- **Deep Dive:** In-depth transaction tracing using advanced GCP RPC methods like `debug_traceTransaction` and `trace_block`. Requires wallet connection. (See: [`Analytics.tsx`](src/components/analytics/Analytics.tsx), [`transaction/trace/route.ts`](src/app/api/blockchain/transaction/trace/route.ts), [`block/trace/route.ts`](src/app/api/blockchain/block/trace/route.ts)).

### WIP

See: [`Analytics Components`](src/components/analytics)
- **Network Congestion:** Real-time view of Ethereum network status (gas prices, pending transactions) relevant to PYUSD.
- **Contract Activity:** Monitor interactions with the PYUSD smart contract (transfers, approvals, etc.).
- **Historical Data:** Explore long-term trends and historical PYUSD performance data (potentially using BigQuery integration).

## Roadmap

Future plans for Phaigo include:

- **Mobile Application:** Native iOS and Android apps for payments on the go.
- **Multi-Chain Expansion:** Support for PYUSD and payments on additional blockchain networks.
- **Merchant Integration:** Tools and features for businesses to easily accept PYUSD payments.
- **Enhanced Analytics:** Deeper transaction insights, spending reports, and visualizations.

## Test the Live App

Visit: [phaigo live](phaigo.vercel.app)

This is the alpha version of the app there could be bugs and rate limiting.

## Testing

Phaigo utilizes [Vitest](https://vitest.dev/) (v3.1.1) with [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/) for unit and component testing, ensuring code reliability and correctness. Tests are located in the `src/tests` directory.

Key areas covered include:

- **Blockchain Synchronization (`blockchain-sync.test.ts`):** Validates the core service responsible for syncing blockchain events (PYUSD transfers) with the internal database, including event processing, payment status updates, handling pending/failed states, and periodic sync logic.
- **Database Integration & Services:** Tests database interactions for payments, payment requests, and user profiles, ensuring data integrity and correct service logic.
- **Error Handling:** Tests verify resilience against database connection issues, blockchain RPC errors, and transaction confirmation failures.
- **Mocking:** Uses Vitest's mocking utilities and custom mocks for Prisma, Blockchain services, and timers to isolate components during testing.
- **CI/CD Ready:** Tests are designed for integration into CI/CD pipelines.

## Installation Guide

Follow these steps to set up Phaigo locally for development.

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Docker](https://www.docker.com/)

### Setup Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/tricodex/phaigo.git # Replace with actual repo URL if available
    cd phaigo
    ```

2.  **Install dependencies:**
    ```bash
    bun install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the project root. You will need to define necessary variables, including:
    - `DATABASE_URL`: Your PostgreSQL connection string (see Docker setup below).
    - `NEXTAUTH_URL`: The base URL for your local development environment (e.g., `http://localhost:3000`).
    - Any other required API keys (e.g., for GCP services, Web3Modal Project ID).

4.  **Start the Database (Docker):**
    This project uses Docker to run a PostgreSQL database container for development.
    ```bash
    bun run docker:dev
    ```
    This command uses `docker-compose.yml` to start the database in the background. Your `DATABASE_URL` in the `.env` file should point to this container (e.g., `postgresql://user:password@localhost:5432/dbname`).

5.  **Run Database Migrations:**
    Apply the database schema using Prisma.
    ```bash
    bun run prisma:migrate
    ```

6.  **Start the Development Server:**
    ```bash
    bun run dev
    ```

7.  **Open the application:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

For local production testing using Docker:

```bash
bun run docker:prod 
```
This uses `docker-compose.prod.yml`.

For a full production deployment, you would typically build the app (`bun run build`), ensure migrations are run against your production database, and start the server (`bun run start`). Refer to Next.js deployment guides for more details on specific platforms.

## License

**Apache License 2.0**

Copyright 2024 Phaigo

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.