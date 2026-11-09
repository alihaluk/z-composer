# Security Policy

## Reporting a vulnerability

Report vulnerabilities privately through [GitHub](https://github.com/alihaluk/z-composer/security/advisories/new). Do not open a public issue.

Include the affected version, the steps to reproduce and, if you have one, a template or catalog file that shows the problem.

## Supported versions

Fixes go into the latest release only.

## Scope

In scope: the designer, the template and catalog import, the preview, the embeddable package and the reference filler (`src/lib/zplFill.ts`).

Out of scope: fillers in other languages, printers, and host applications that embed the designer. `INTEGRATION_GUIDE.md` says how a host should treat files from outside.
