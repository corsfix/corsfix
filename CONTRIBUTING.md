# Contributing

Thank you for your interest in contributing to Corsfix! We welcome contributions in the form of ideas, issues, bug reports, feedback, and code improvements.

## Project Structure

Corsfix is a pnpm monorepo containing the following packages:

- **app** (Next.js) - The dashboard
- **proxy** (HyperExpress) - The CORS proxy server

## Prerequisites

- Node.js version 20 or higher
- pnpm package manager
- Docker (for running infrastructure)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/corsfix/corsfix.git
   cd corsfix
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start the infrastructure**

   ```bash
   docker compose up -d
   ```

   This will start the database and cache services.

4. **Set up environment variables**

   Configure the environment variables for both the `app` and `proxy` packages. Refer to the `.env.example` files in each package directory.

   > Specific to encryption keys, you will need to generate them using the following command: `openssl rand -base64 32`, which will generate a random 32-byte base64 string.
   >
   > This will be needed for both the encryption key and authentication secret.

5. **Start the development servers**

   ```bash
   # Start the dashboard app
   pnpm run dev:app

   # Start the proxy server
   pnpm run dev:proxy
   ```

## Contributing Code

We follow the standard GitHub workflow for code contributions:

1. **Fork the repository** to your GitHub account
2. **Create a new branch** for your feature or bug fix
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** based on on your feature or bug fix
4. **Commit your changes** with descriptive commit messages
   ```bash
   git commit -m "feat: add new feature description"
   ```
5. **Push your changes** to your fork
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a pull request** from your fork to the main repository

## Questions?

If you have any questions about contributing, feel free to open an issue or reach out to us.
