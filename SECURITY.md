# Security Policy

## The short version

Orbi is a **fully client-side** web app. There is **no backend, no server, no accounts, and no
telemetry**. All gameplay data is bundled statically, and your progress is stored only in your own
browser (IndexedDB) — nothing you do in Orbi is ever sent anywhere. This keeps the attack surface
small, but security reports are still very welcome.

## Supported versions

The deployed app is the latest commit on `main` (published to GitHub Pages). Fixes land there;
there are no separately maintained older releases.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Instead, report it privately via GitHub's
[**Report a vulnerability**](https://github.com/mokaddem/geography-quiz/security/advisories/new)
(Security → Advisories), or by email to **mokaddem.sami@gmail.com**.

Please include:

- a description of the issue and its potential impact,
- steps to reproduce (a proof of concept if you have one), and
- any suggested remediation.

We'll acknowledge your report as soon as we reasonably can, keep you updated on progress, and credit
you in the fix if you'd like. Thanks for helping keep Orbi safe. 🙏
