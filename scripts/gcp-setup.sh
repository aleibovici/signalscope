#!/usr/bin/env bash
#
# One-time GCP infrastructure provisioning for SignalScope.
# Usage: bash scripts/gcp-setup.sh
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - gh CLI installed and authenticated (gh auth login)
#   - A GCP project already created
#   - Fill in .env.production with your values, then run this script
#
set -euo pipefail

# ─── Load .env.production ────────────────────────────────────────────────────
ENV_FILE="${ENV_FILE:-.env.production}"
if [ -f "${ENV_FILE}" ]; then
  echo "==> Loading ${ENV_FILE}"
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
else
  echo "ERROR: ${ENV_FILE} not found. Copy .env.example and fill in values."
  exit 1
fi

# ─── Configurable variables ──────────────────────────────────────────────────
GCP_PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID in ${ENV_FILE}}"
GCP_REGION="${GCP_REGION:-us-central1}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-signalscope-db}"
DB_NAME="${DB_NAME:-signalscope}"
DB_USER="${DB_USER:-signalscope}"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD in ${ENV_FILE}}"
AUTH_SECRET="${AUTH_SECRET:?Set AUTH_SECRET in ${ENV_FILE}}"
OPENAI_API_KEY="${OPENAI_API_KEY:?Set OPENAI_API_KEY in ${ENV_FILE}}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY in ${ENV_FILE}}"
GITHUB_REPO="${GITHUB_REPO:-aleibovici/signalscope}"

SERVICE_ACCOUNT="signalscope-run"
DEPLOY_SERVICE_ACCOUNT="github-deployer"
WIF_POOL="github"
WIF_PROVIDER="github-actions"
REPO_NAME="signalscope"
WEB_SERVICE="signalscope-web"
HARVESTER_JOB="signalscope-harvester"
SCHEDULER_JOB="signalscope-harvest-schedule"

CLOUD_SQL_CONNECTION="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION}"

echo "==> Setting project to ${GCP_PROJECT_ID}"
gcloud config set project "${GCP_PROJECT_ID}"

# ─── Enable APIs ─────────────────────────────────────────────────────────────
echo "==> Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com

# ─── Artifact Registry ──────────────────────────────────────────────────────
echo "==> Creating Artifact Registry repo"
gcloud artifacts repositories create "${REPO_NAME}" \
  --repository-format=docker \
  --location="${GCP_REGION}" \
  --description="SignalScope container images" \
  --quiet || true

# ─── Cloud SQL ───────────────────────────────────────────────────────────────
echo "==> Creating Cloud SQL instance (this takes a few minutes)"
gcloud sql instances create "${DB_INSTANCE_NAME}" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --edition=ENTERPRISE \
  --region="${GCP_REGION}" \
  --storage-auto-increase \
  --quiet || true

echo "==> Creating database and user"
gcloud sql databases create "${DB_NAME}" \
  --instance="${DB_INSTANCE_NAME}" \
  --quiet || true

gcloud sql users create "${DB_USER}" \
  --instance="${DB_INSTANCE_NAME}" \
  --password="${DB_PASSWORD}" \
  --quiet || true

# ─── Secret Manager ─────────────────────────────────────────────────────────
echo "==> Storing secrets in Secret Manager"
store_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "${name}" --quiet 2>/dev/null; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=-
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" --data-file=- --replication-policy=automatic
  fi
}

store_secret "DATABASE_URL"     "${DATABASE_URL}"
store_secret "AUTH_SECRET"      "${AUTH_SECRET}"
store_secret "OPENAI_API_KEY"   "${OPENAI_API_KEY}"
store_secret "ANTHROPIC_API_KEY" "${ANTHROPIC_API_KEY}"

# ─── Service Account ────────────────────────────────────────────────────────
echo "==> Creating service account"
SA_EMAIL="${SERVICE_ACCOUNT}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "${SERVICE_ACCOUNT}" \
  --display-name="SignalScope Cloud Run" \
  --quiet || true

echo "==> Granting IAM roles"
for role in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${role}" \
    --quiet
done

# ─── Initial Cloud Run Service (web) ────────────────────────────────────────
echo "==> Deploying initial Cloud Run web service (placeholder image)"
IMAGE_BASE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPO_NAME}"

# Use a placeholder for the initial deploy; CI/CD will push the real image
gcloud run deploy "${WEB_SERVICE}" \
  --image="us-docker.pkg.dev/cloudrun/container/hello" \
  --region="${GCP_REGION}" \
  --service-account="${SA_EMAIL}" \
  --add-cloudsql-instances="${CLOUD_SQL_CONNECTION}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production,AI_PRIMARY_PROVIDER=openai" \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --cpu-boost \
  --allow-unauthenticated \
  --quiet

# ─── Cloud Run Job (harvester) ──────────────────────────────────────────────
echo "==> Creating Cloud Run harvester job (placeholder image)"
gcloud run jobs create "${HARVESTER_JOB}" \
  --image="us-docker.pkg.dev/cloudrun/container/hello" \
  --region="${GCP_REGION}" \
  --service-account="${SA_EMAIL}" \
  --set-cloudsql-instances="${CLOUD_SQL_CONNECTION}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production,AI_PRIMARY_PROVIDER=openai" \
  --memory=512Mi \
  --cpu=1 \
  --task-timeout=15m \
  --max-retries=1 \
  --quiet

# ─── Cloud Scheduler ────────────────────────────────────────────────────────
echo "==> Creating Cloud Scheduler job (every 4 hours)"
gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
  --location="${GCP_REGION}" \
  --schedule="0 */4 * * *" \
  --uri="https://${GCP_REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${GCP_PROJECT_ID}/jobs/${HARVESTER_JOB}:run" \
  --http-method=POST \
  --oauth-service-account-email="${SA_EMAIL}" \
  --quiet || true

# ─── Workload Identity Federation (GitHub Actions → GCP) ────────────────────
echo "==> Setting up Workload Identity Federation for GitHub Actions"
GCP_PROJECT_NUMBER=$(gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)')
DEPLOY_SA_EMAIL="${DEPLOY_SERVICE_ACCOUNT}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# Create deployer service account
gcloud iam service-accounts create "${DEPLOY_SERVICE_ACCOUNT}" \
  --display-name="GitHub Actions Deployer" \
  --quiet || true

# Grant deployer roles
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/run.invoker; do
  gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="${role}" \
    --quiet
done

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "${WIF_POOL}" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --quiet || true

# Create OIDC Provider for GitHub
gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER}" \
  --location="global" \
  --workload-identity-pool="${WIF_POOL}" \
  --display-name="GitHub Actions" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --quiet || true

# Allow GitHub repo to impersonate the deployer service account
gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}" \
  --quiet

WIF_PROVIDER_FULL="projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"

# ─── Set GitHub repo variables ───────────────────────────────────────────────
echo "==> Setting GitHub Actions repository variables"
gh variable set GCP_PROJECT_ID --body "${GCP_PROJECT_ID}" --repo "${GITHUB_REPO}"
gh variable set GCP_REGION     --body "${GCP_REGION}"     --repo "${GITHUB_REPO}"
gh variable set WIF_PROVIDER   --body "${WIF_PROVIDER_FULL}" --repo "${GITHUB_REPO}"
gh variable set WIF_SERVICE_ACCOUNT --body "${DEPLOY_SA_EMAIL}" --repo "${GITHUB_REPO}"

echo ""
echo "=== Setup complete ==="
echo "Cloud Run URL:"
gcloud run services describe "${WEB_SERVICE}" --region="${GCP_REGION}" --format='value(status.url)'
echo ""
echo "GitHub Actions variables set on ${GITHUB_REPO}:"
echo "  GCP_PROJECT_ID      = ${GCP_PROJECT_ID}"
echo "  GCP_REGION          = ${GCP_REGION}"
echo "  WIF_PROVIDER        = ${WIF_PROVIDER_FULL}"
echo "  WIF_SERVICE_ACCOUNT = ${DEPLOY_SA_EMAIL}"
echo ""
echo "Next steps:"
echo "  1. Push code to main to trigger CI/CD deployment"
echo "  2. Run Prisma migrations against Cloud SQL (via Cloud SQL Auth Proxy)"
echo "  3. Seed the database: npm run db:seed"
