# Build docker image
docker build -t api .

# Tag docker image
docker tag api us.gcr.io/reading-rewards-209516/api

# Push image to google container repo
gcloud docker -- push us.gcr.io/reading-rewards-209516/api

# Bring down currently running pod
kubectl delete pods -l role=api