#!/usr/bin/env bash
# Certificat de distribution Apple, sans Mac. Étape 1 : clé + CSR. Étape 2 (après téléchargement du .cer) : .p12.
set -euo pipefail
DIR="${1:-./ios-signing}"; mkdir -p "$DIR"; cd "$DIR"
if [ ! -f distribution.key ]; then
  openssl genrsa -out distribution.key 2048
  openssl req -new -key distribution.key -out distribution.csr -subj "/emailAddress=${EMAIL:-dev@example.com}/CN=Zilin/C=FR"
  echo "CSR créée : $DIR/distribution.csr. Dépose-la sur developer.apple.com (Certificates > Apple Distribution), télécharge distribution.cer ici, puis relance le script."
  exit 0
fi
[ -f distribution.cer ] || { echo "distribution.cer manquant"; exit 1; }
openssl x509 -in distribution.cer -inform DER -out distribution.pem
openssl pkcs12 -export -inkey distribution.key -in distribution.pem -out distribution.p12 -legacy -passout "pass:${P12_PASSWORD:?P12_PASSWORD requis}"
echo "distribution.p12 prêt. Secret IOS_CERT_P12 : $(base64 -w0 distribution.p12 | head -c 24)..."
echo "Ne commite jamais ce dossier."
