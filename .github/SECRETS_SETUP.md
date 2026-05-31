# GitHub Secrets & Variables Setup Guide

## Repository Secrets (Settings → Secrets and variables → Actions)

### Shared API Keys
| Secret | Description | Where to get |
|--------|-------------|--------------|
| `GEMINI_API_KEY` | Google Gemini AI | https://aistudio.google.com/app/apikey |
| `GROQ_API_KEY` | Groq AI chat | https://console.groq.com/keys |
| `ELEVENLABS_API_KEY` | Text-to-speech | https://elevenlabs.io/app/settings/api-keys |
| `SLACK_WEBHOOK_URL` | Deploy notifications | Slack App → Incoming Webhooks |

### Staging Environment Secrets
| Secret | Example Value |
|--------|---------------|
| `STAGING_HOST` | `staging.yourdomain.com` |
| `STAGING_USER` | `deploy` |
| `STAGING_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `STAGING_SSH_PORT` | `22` |
| `STAGING_MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/gdbot_staging` |
| `STAGING_JWT_SECRET` | 32+ char random string |
| `STAGING_ADMIN_JWT_SECRET` | 32+ char random string |

### Production Environment Secrets
| Secret | Example Value |
|--------|---------------|
| `PROD_HOST` | `yourdomain.com` |
| `PROD_USER` | `deploy` |
| `PROD_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `PROD_SSH_PORT` | `22` |
| `PROD_MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/gdbot_prod` |
| `PROD_JWT_SECRET` | 64+ char random string |
| `PROD_ADMIN_JWT_SECRET` | 64+ char random string |

## Repository Variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Staging | Production |
|----------|---------|------------|
| `STAGING_URL` | `https://staging.yourdomain.com` | — |
| `STAGING_APP_DIR` | `/opt/gdplatform` | — |
| `STAGING_CLIENT_ORIGINS` | `https://staging.yourdomain.com` | — |
| `PROD_URL` | — | `https://yourdomain.com` |
| `PROD_APP_DIR` | — | `/opt/gdplatform` |
| `PROD_CLIENT_ORIGINS` | — | `https://yourdomain.com` |

## Generating Secure Secrets

```bash
# JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SSH key pair for deploy user
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key
# Add deploy_key.pub to server's ~/.ssh/authorized_keys
# Add deploy_key (private) as PROD_SSH_KEY / STAGING_SSH_KEY secret
```

## Server Setup (one-time)

```bash
# On your server
sudo mkdir -p /opt/gdplatform
sudo chown deploy:deploy /opt/gdplatform

# Copy docker-compose files
scp docker-compose.prod.yml deploy@yourserver:/opt/gdplatform/
scp docker-compose.staging.yml deploy@yourserver:/opt/gdplatform/

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
```
