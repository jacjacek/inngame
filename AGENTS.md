# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Deployment model

This repository is edited by Hermes on the small Mikrus control-plane host. That host must never install dependencies, compile, bundle, export, lint, type-check, start Metro/Expo/Vite, or run a preview server.

- On Mikrus, limit work to reading/editing source, `git status`, `git diff`, commits, pulls, and pushes.
- Work on the `develop` branch unless the user explicitly requests a production release.
- Push completed changes to `origin develop`. GitHub Actions performs `npm ci` and the Expo web export on a hosted runner.
- The development deployment is published automatically at https://dev-tenis.walasek.xyz/.
- Do not run `npm`, `npx`, `yarn`, `pnpm`, `bun`, Expo/Metro, TypeScript, Vite, Webpack, or local HTTP preview commands on Mikrus, even for validation.
- Treat the GitHub Actions result and the deployed development URL as the build and runtime verification environment.
- Do not push or merge to `master` unless the user explicitly asks to update production.
