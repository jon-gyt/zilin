# iOS sans Mac

Le binaire iOS est compilé et signé sur un runner macOS de GitHub Actions, à chaque tag `ios-*`. Rien n'est compilé en local.

## Une fois

1. Inscription au Developer Program depuis l'app Apple Developer sur l'iPhone.
2. App Store Connect : créer l'app (bundle id `com.zilin.app` : l'identifiant d'avant Wenlu, gardé parce qu'un bundle id ne se renomme pas ; le nom affiché vient d'`appName`), une clé API (rôle App Manager). Noter Issuer ID, Key ID, et télécharger le `.p8`.
3. Certificat de distribution, sous Linux : `scripts/ios-cert.sh` génère la clé privée et la CSR. Déposer la CSR sur developer.apple.com (Certificates, Apple Distribution), télécharger le `.cer`, puis relancer le script pour produire le `.p12`. La clé privée reste chez toi : ne jamais la laisser générer par le runner, elle disparaîtrait avec lui.
4. Profil de provisioning App Store pour le bundle id, nommé « Zilin AppStore » (le nom que `ios-testflight.yml` attend), téléchargé en `.mobileprovision`.
5. Secrets GitHub : `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (base64), `IOS_CERT_P12` (base64), `IOS_CERT_PASSWORD`, `IOS_PROFILE` (base64).

## À chaque livraison

```bash
git tag ios-0.1.0 && git push --tags
```

Le workflow génère `app/ios/` (jamais commité), ajoute le scheme partagé, archive, signe, envoie sur TestFlight. Le build apparaît dans TestFlight sur l'iPhone.

## Pièges connus

- `app/ios/` doit rester hors Git : un projet Xcode commité sans Mac pour le régénérer devient une photo figée.
- `typescript` doit être en devDependency, sinon `cap` refuse de lire `capacitor.config.ts`.
- Xcode n'écrit le scheme partagé qu'à sa première ouverture graphique : le workflow le crée.
- Apple relève régulièrement la version minimale de Xcode : garder `macos-latest`.

## Repli

Si le pipeline résiste plus de deux soirées : Capawesome Cloud ou Capgo Builder (service géré). Mac loué à l'heure (Scaleway) uniquement pour un bug natif non reproductible.
