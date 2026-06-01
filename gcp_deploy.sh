#!/bin/bash

# Add local gcloud to PATH
export PATH=$PATH:$(pwd)/google-cloud-sdk/bin
echo "Using gcloud from: $(which gcloud)"

# Configuration
PROJECT_ID=$(gcloud config get-value project)
SERVICE_NAME="tender-inquiry"
REGION="asia-east1" # Taiwan region (changhua)

if [ -z "$PROJECT_ID" ]; then
  echo "Error: No Google Cloud project selected."
  echo "Run 'gcloud config set project YOUR_PROJECT_ID' first."
  exit 1
fi

echo "Deploying to Project: $PROJECT_ID in Region: $REGION"

# 1. Enable necessary APIs
echo "Enabling Cloud Build and Cloud Run APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# 2. Build and Submit Docker image to Container Registry
echo "Building and submitting Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# 3. Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2

echo "Deployment Complete!"
echo "Service URL:"
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
