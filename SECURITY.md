# Security Policy

## Reporting a Vulnerability

`@advanced-elements/*` is a public Vue 3 + Element Plus component library. If you discover a security vulnerability, **do not** open a public issue.

Please report it privately via GitHub's [private vulnerability reporting](https://github.com/ChuHingYee/advanced-elements/security/advisories/new) (Security → Report a vulnerability), or by email to the maintainer. Include:

- affected package and version (`@advanced-elements/table@4.0.0`, etc.)
- reproduction steps or proof of concept
- impact assessment (data exfiltration, XSS, prototype pollution, …)

You will receive an acknowledgement within 7 days and a fix or mitigation plan within 30 days. Coordinated disclosure is appreciated; we will credit reporters in the release notes unless asked not to.

## Supported Versions

Security fixes are applied to the latest released version of each package. Older versions receive fixes only on a best-effort basis.

## Scope

In scope: XSS in rendered cell content, prototype pollution in merge utilities, unsafe `v-html` usage, insecure default in data export/print paths (all data exits go through `utils/security.ts`).

Out of scope: vulnerabilities in upstream dependencies (`element-plus`, `vue`, `xlsx`) — report those to their maintainers; issues requiring a malicious build pipeline or compromised registry.

## Supply Chain

This project publishes to npm with provenance (`NPM_CONFIG_PROVENANCE`) and runs `pnpm audit --audit-level=moderate` in CI. See `pnpm-workspace.yaml` for the audit policy and explicit ignores (unpatchable advisories only).
