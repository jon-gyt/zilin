import type { CapacitorConfig } from '@capacitor/cli';
/*
 * appId garde l'identifiant d'avant Wenlu : c'est le bundle id que la signature iOS
 * attend (profil de provisioning, ExportOptions de ios-testflight.yml, App Store
 * Connect), et Apple ne permet pas d'en changer pour une app existante.
 */
const config: CapacitorConfig = { appId: 'com.zilin.app', appName: 'Wenlu', webDir: 'dist', ios: { contentInset: 'automatic' } };
export default config;
