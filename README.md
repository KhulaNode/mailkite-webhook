# Mailkite webhook receiver

Small Node.js + Express receiver for KhulaNode's Mailkite inbound-email pilot.

- `POST /hooks/mail`: logs timestamp, all request headers, and the complete body,
  then immediately acknowledges with HTTP 200.
- `GET /health`: returns `{"ok":true}`.
- Accepts JSON, text and arbitrary raw payloads. Original body bytes are retained
  as base64 alongside UTF-8 text. Original header casing and duplicate headers are
  retained in `rawHeaders`. Valid JSON is also parsed for easier inspection.
- Listens internally on `0.0.0.0:3005`.
- Runs as a non-root user with a read-only container filesystem and rotated logs.

## Deploy through Dokploy with HTTPS

1. Create a Docker Compose service in the desired KhulaNode project/environment.
2. Select the GitHub repository `KhulaNode/mailkite-webhook`, branch `main`, and
   Compose path `docker-compose.yml`. Grant the Dokploy GitHub integration access
   to this private repository.
3. Deploy. The Compose service is named `receiver` and its internal port is `3005`.
4. In Dokploy **Domains**, add the selected hostname with:
   - Service: `receiver`
   - Container port: `3005`
   - Path: `/`
   - Strip Path: disabled
   - HTTPS: enabled, certificate provider: Let's Encrypt
5. Point the hostname's DNS A record at the VPS IPv4. On the current VPS this is
   `46.224.162.62`. Dokploy handles the reverse proxy and TLS certificate.
6. Verify `https://<hostname>/health`, then configure Mailkite to POST to
   `https://<hostname>/hooks/mail`.

The default Compose file exposes port 3005 only inside Docker. It does not bind a
host port or hard-code a hostname or Traefik labels. Dokploy generates the domain
configuration. Internal `expose` alone does not publish an HTTPS endpoint; DNS and
the Dokploy Domain entry are required.

The existing direct-HTTP pilot at `/opt/mailkite-webhook` remains separate. Retire
that instance only after verifying the new HTTPS endpoint.

## Direct-port testing

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
curl http://127.0.0.1:3005/health
curl -i http://127.0.0.1:3005/hooks/mail \
  -H 'Content-Type: application/json' \
  --data '{"subject":"Mailkite test","body":"hello"}'
```

Opening `/hooks/mail` in a browser sends GET and returns 404. Use `/health` for a
browser availability check. The direct-port override requires host port 3005 to
be free.

## Inspect and dispose

```bash
docker compose logs --tail 20 receiver
docker compose logs --follow receiver
docker compose down
```

This is an unauthenticated inspection endpoint and deliberately logs complete
headers and bodies, which may include credentials and private email content. Keep
test traffic appropriate for that purpose and apply a retention policy before
using real mail. It does not send mail, store messages in a database or integrate
with KhulaMail/Haraka.

## Development and validation

Node.js 24 or newer:

```bash
npm ci --ignore-scripts
npm test
```

GitHub Actions tests health, exact JSON/Unicode bytes, duplicate headers, text line
endings, malformed JSON and binary payloads, validates Compose and builds the image.
No credentials, email logs or environment files belong in the repository.
