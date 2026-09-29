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

Le workflow génère `app/ios/` (jamais commité), le retouche, ajoute le scheme partagé, archive, signe, envoie sur TestFlight. Le build apparaît dans TestFlight sur l'iPhone.

Le tag donne la version affichée (`ios-0.1.0` → 0.1.0, un à trois entiers) ; le numéro du run donne le numéro de build. Relancer un run garde son numéro : si l'envoi a déjà réussi, TestFlight refusera le même build, pousser un nouveau tag.

## Les greffons natifs

`npx cap sync ios` lit les dépendances de `app/package.json` qui déclarent un dossier iOS et les écrit dans le Podfile ; `pod install` les compile avec l'app. Aujourd'hui : `@capacitor/haptics` (retour haptique), `@capacitor/local-notifications` (rappel quotidien), `@capawesome/capacitor-app-review` (demande de note) et `@capacitor-community/text-to-speech` (la voix chinoise de l'iPhone, par AVSpeechSynthesizer, brief §7 ; pod `CapacitorCommunityTextToSpeech`). L'étape « Vérifier les greffons natifs » échoue si l'un manque au Podfile engendré. Aucun greffon ne demande de clé d'`Info.plist` : l'accord pour les notifications se demande à l'exécution, à la première session (jamais au lancement) ou dans Réglages, et la fenêtre de note est celle du système, limitée par iOS à trois affichages par an. Le micro de « Dis-le » (story 9.1) ne passe par aucun greffon : la page l'ouvre par `getUserMedia`, dans la WKWebView (iOS 14.3 et plus), et Capacitor 6 accorde la capture à sa page (`WebViewDelegationHandler`, `requestMediaCapturePermissionFor` rend `.grant`) ; seul iOS demande l'accord, une fois, avec la phrase de `NSMicrophoneUsageDescription` (ci-dessous). Sans cette clé, iOS fermerait l'app au premier appel du micro. Non vérifié hors CI : `pod install` et la compilation des quatre greffons ; sous Linux, `cap add ios` a bien écrit les trois premiers pods dans le Podfile, et `patch.rb` s'y est rejoué sans avertissement. Le greffon de la voix ne demande aucune clé d'`Info.plist` ; à son chargement, il met la session audio de l'app en lecture (`AVAudioSession` `.playback`, `.duckOthers`), et la page la rend à la lecture après chaque prise au micro (`navigator.audioSession`).

## Ce que la CI pose sur le projet engendré

`npx cap add ios` part du gabarit de Capacitor : icône et écran de lancement de Capacitor, pas de manifeste de confidentialité. L'étape « Retoucher le projet iOS » lance `app/ios-template/patch.rb` (gemme `xcodeproj`, déjà sur le runner avec CocoaPods ; installée sinon), rejouable :

- `PrivacyInfo.xcprivacy` copié dans `ios/App/App/` et ajouté à la cible App (phase Resources) : aucun pistage, aucun domaine de pistage, aucune donnée collectée, aucune API à raison déclarée. Capacitor 6 et CapacitorCordova embarquent leurs propres manifestes, vides aussi ; `@capacitor/haptics` n'appelle que `UIFeedbackGenerator`, `@capacitor/local-notifications` que `UNUserNotificationCenter` (le rappel quotidien, programmé sur l'appareil), `@capawesome/capacitor-app-review` que `SKStoreReviewController` et `AppStore.requestReview` (la demande de note), `@capacitor-community/text-to-speech` qu'`AVSpeechSynthesizer` et `AVAudioSession` (la voix, sur l'appareil). Le script relit les sources des greffons du Podfile et avertit dans le journal (`::warning`) si l'un appelle `UserDefaults`, les dates de fichiers, l'espace disque, le temps depuis le démarrage ou les claviers actifs : il faudra alors le déclarer dans `app/ios-template/PrivacyInfo.xcprivacy`, avec sa raison.
- L'icône : `app/ios-template/AppIcon-1024.png`, seule entrée de `AppIcon.appiconset` (Xcode dérive les autres tailles). 文 sur papier de riz, le point en cinabre, depuis les traits, sans transparence ; `npm run icons` la réécrit avec les icônes de la PWA.
- L'écran de lancement : papier de riz uni à la place du logo de Capacitor ; l'app écrit ensuite 文 elle-même.
- `Info.plist` : `ITSAppUsesNonExemptEncryption` à `false` (aucune cryptographie propre, aucune requête réseau : App Store Connect ne pose plus la question de l'export à chaque build), `UIUserInterfaceStyle` à `Light` (un seul thème, la barre d'état reste lisible en mode sombre), `NSMicrophoneUsageDescription` : « Wenlu écoute ta voix pour reconnaître le ton du caractère que tu dis. L'analyse se fait sur ton iPhone : rien n'est enregistré ni envoyé. » (« Dis-le », story 9.1 ; la voix ne quitte pas l'iPhone, le manifeste de confidentialité n'a donc aucune donnée audio à déclarer). La même étape de la CI relit ensuite la clé dans l'`Info.plist` retouché (`PlistBuddy`) et échoue si elle manque. Le nom affiché sous l'icône est `appName` de `capacitor.config.ts`, « Wenlu », comme la PWA sur l'écran d'accueil (`short_name`) ; le nom sur l'App Store, lui, se saisit dans App Store Connect. Le script échoue si Capacitor n'a pas repris `appName`.
- `MARKETING_VERSION` et `CURRENT_PROJECT_VERSION` de la cible, depuis le tag et le run.

Non vérifié hors CI : `cap add ios` sur le runner, `pod install`, l'archive, la signature et l'envoi. Le script a été rejoué sous Linux sur le gabarit de `@capacitor/cli` 6.2 (projet, icône, écran, `Info.plist`, idempotence). Le 29 septembre 2026, rejoué de même avec la clé du micro, relue dans l'`Info.plist`. À vérifier sur un iPhone : la demande du micro au premier « Dis-le », une seule fois ; que la lecture de l'audio repasse sur le haut-parleur après une prise de son ; la fréquence réelle du micro (48 kHz en général, ramenée à 16 kHz par l'app).

## App Store Connect : ce que tu remplis

Aucune de ces valeurs n'est un secret ; rien de tout cela n'est dans le dépôt.

- Nom : « Wenlu 文路 » (30 caractères au plus ; « Wenlu » seul si le nom est pris). Langue principale : français ; ajouter la localisation anglaise.
- Catégorie principale : Éducation. Secondaire, facultative : Référence.
- URL de politique de confidentialité, par localisation : `https://jon-gyt.github.io/zilin/confidentialite/` (français), `https://jon-gyt.github.io/zilin/en/privacy/` (anglais). Les pages sont engendrées avec le site public (`app/scripts/site/`) et publiées par `pages.yml` ; leur adresse est testée et ne doit pas bouger.
- Confidentialité de l'app (App Privacy) : « Non, nous ne collectons pas de données » (Data Not Collected). Rien ne quitte l'appareil : ni compte, ni analyse, ni publicité, ni réseau.
- Classification par âge : répondre « Aucun » ou « Non » à tout le questionnaire (pas de contenu généré par les utilisateurs, pas d'accès web libre, pas de messagerie, pas d'achat pour l'instant) : 4+.
- Droits sur le contenu : oui, l'app contient du contenu de tiers, sous licences qui le permettent (Make Me a Hanzi sous Arphic Public License, CC-CEDICT sous CC BY-SA 4.0, Unihan ; `docs/sources-licences.md`).
- Conformité à l'exportation : déjà réglée par `ITSAppUsesNonExemptEncryption`.
- TestFlight : les testeurs internes (jusqu'à 100 membres de l'équipe) n'attendent aucune revue. Les testeurs externes (les 200 de la bêta, brief §14) passent par la revue bêta d'Apple : elle demande une description de la bêta, une adresse de contact et « connexion requise : non ».
- Achats intégrés, abonnement, Small Business Program : plus tard (story 6.2). Ce build est gratuit, sans achat.

## Pièges connus

- `app/ios/` doit rester hors Git : un projet Xcode commité sans Mac pour le régénérer devient une photo figée.
- `typescript` doit être en devDependency, sinon `cap` refuse de lire `capacitor.config.ts`.
- Xcode n'écrit le scheme partagé qu'à sa première ouverture graphique : le workflow le crée.
- Apple relève régulièrement la version minimale de Xcode : garder `macos-latest`.

## Repli

Si le pipeline résiste plus de deux soirées : Capawesome Cloud ou Capgo Builder (service géré). Mac loué à l'heure (Scaleway) uniquement pour un bug natif non reproductible.
