#!/bin/bash
echo "Waiting for /api/system-logs availability..."
wait_seconds=0
while [ $wait_seconds -lt 600 ]; do
    resp=$(curl -k -s "https://rexhoh-tender-inquiry.hf.space/api/system-logs")
    # Check if we got the client HTML (means route not ready) or error
    if [[ "$resp" != *"<title>client</title>"* && "$resp" != *"Bad Gateway"* && "$resp" != "" ]]; then
        echo "✅ Deployment seems live. Response started with: ${resp:0:50}..."
        break
    fi
    echo "⏳ Still waiting... ($wait_seconds/180s) - Response was HTML or Empty"
    sleep 10
    wait_seconds=$((wait_seconds + 10))
done

if [ $wait_seconds -ge 180 ]; then
    echo "❌ Timeout waiting for deployment. Please check Hugging Face console manually."
    exit 1
fi

echo "🚀 Triggering search for 'AI'..."
# Run search in background
curl -k -s -X POST -H "Content-Type: application/json" \
     -d '{"keyword":"AI", "startDate":"2026/01/15", "endDate":"2026/02/17"}' \
     "https://rexhoh-tender-inquiry.hf.space/api/search" > /tmp/search_output.txt &

echo "📋 Polling logs..."
for i in {1..12}; do
    sleep 5
    echo "--- Log Snapshot $i ---"
    curl -k -s "https://rexhoh-tender-inquiry.hf.space/api/system-logs" | tail -n 20
done
