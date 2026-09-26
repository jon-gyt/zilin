# frozen_string_literal: true
#
# Retouche le projet Xcode que `npx cap add ios` vient d'engendrer dans la CI
# (`.github/workflows/ios-testflight.yml`). `app/ios/` n'est jamais commité : tout ce
# que l'app iOS a de propre part d'ici, à chaque build, et le script peut se rejouer.
#
#   cd app && ruby ios-template/patch.rb [ios/App]
#
# Ce qu'il fait :
# 1. pose `PrivacyInfo.xcprivacy` dans le dossier de l'app et l'ajoute à la cible App
#    (phase Resources) : aucun pistage, aucune donnée collectée, aucune API à raison
#    déclarée. Capacitor 6 embarque ses propres manifestes, vides eux aussi ;
# 2. avertit dans le journal si un greffon natif (lu dans le Podfile) appelle une API à
#    raison déclarée : il faudra alors la déclarer dans le manifeste, avec sa raison ;
# 3. remplace l'icône de Capacitor par `AppIcon-1024.png` (1024, sans transparence,
#    engendrée par `npm run icons`) ;
# 4. remplace l'écran de lancement de Capacitor (son logo, en dégradé) par le papier de
#    riz uni : l'app écrit ensuite le logo elle-même, trait par trait ;
# 5. Info.plist : `ITSAppUsesNonExemptEncryption` à faux (aucune cryptographie propre :
#    l'app ne fait même aucune requête réseau) ; `UIUserInterfaceStyle` à Light, un seul
#    thème, le papier clair (brief §5), pour que la barre d'état reste lisible quand
#    l'iPhone est en mode sombre ; et vérifie que le nom affiché vient d'`appName`
#    (`capacitor.config.ts`) ;
# 6. numéros de version : `MARKETING_VERSION` depuis `WENLU_VERSION` (le tag `ios-0.1.0`
#    donne 0.1.0), `CURRENT_PROJECT_VERSION` depuis `WENLU_BUILD` (le numéro de run de la
#    CI) : TestFlight refuse deux envois du même numéro de build.
#
# Outils : la gemme `xcodeproj`, déjà là sur les runners macOS avec CocoaPods, et la
# bibliothèque standard de Ruby. Rien à installer.

require 'fileutils'
require 'json'
require 'zlib'
require 'xcodeproj'

# Les runners n'ont pas toujours une locale UTF-8 : les sources et les plists le sont.
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

ICI = __dir__
RACINE = File.expand_path(ARGV[0] || File.join(ICI, '..', 'ios', 'App'))
DOSSIER_APP = File.join(RACINE, 'App')
PROJET = File.join(RACINE, 'App.xcodeproj')
INFO = File.join(DOSSIER_APP, 'Info.plist')
ASSETS = File.join(DOSSIER_APP, 'Assets.xcassets')

# Le papier de riz, #F4EEE2 (brief §5, `src/lib/tokens.css`).
PAPIER = [0xF4, 0xEE, 0xE2].freeze

def echec(message)
  warn "patch.rb : #{message}"
  exit 1
end

def etape(message)
  puts "patch.rb : #{message}"
end

[DOSSIER_APP, PROJET, INFO, ASSETS].each do |chemin|
  echec("#{chemin} introuvable ; lancer d'abord `npx cap add ios`.") unless File.exist?(chemin)
end

# ---------- 1. le manifeste de confidentialité ----------

FileUtils.cp(File.join(ICI, 'PrivacyInfo.xcprivacy'), File.join(DOSSIER_APP, 'PrivacyInfo.xcprivacy'))

projet = Xcodeproj::Project.open(PROJET)
cible = projet.targets.find { |t| t.name == 'App' } or echec('cible App absente du projet.')
groupe = projet.main_group.children.find { |g| g.respond_to?(:path) && g.path == 'App' } or
  echec('groupe App absent du projet.')

ref = groupe.files.find { |f| f.path == 'PrivacyInfo.xcprivacy' }
unless ref
  ref = groupe.new_reference('PrivacyInfo.xcprivacy')
  ref.last_known_file_type = 'text.xml'
end
unless cible.resources_build_phase.files_references.include?(ref)
  cible.resources_build_phase.add_file_reference(ref, true)
end
etape('PrivacyInfo.xcprivacy posé dans la cible App (Resources).')

# ---------- 6. les numéros de version ----------

version = ENV.fetch('WENLU_VERSION', '').sub(/\Aios-/, '')
build = ENV.fetch('WENLU_BUILD', '')
unless version.empty?
  echec("WENLU_VERSION « #{version} » : attendu 1 à 3 entiers séparés par des points.") unless version.match?(/\A\d+(\.\d+){0,2}\z/)
end
unless build.empty?
  echec("WENLU_BUILD « #{build} » : attendu un entier.") unless build.match?(/\A\d+\z/)
end
cible.build_configurations.each do |conf|
  conf.build_settings['MARKETING_VERSION'] = version unless version.empty?
  conf.build_settings['CURRENT_PROJECT_VERSION'] = build unless build.empty?
end
projet.save
etape("version #{version.empty? ? '(celle du gabarit)' : version}, build #{build.empty? ? '(celui du gabarit)' : build}.")

# ---------- 2. les API à raison déclarée des greffons ----------

API_A_RAISON = /
  \b(?:NS)?UserDefaults\b |
  \bsystemUptime\b | \bmach_absolute_time\b |
  \b(?:creationDate|modificationDate|fileModificationDate|contentModificationDateKey|creationDateKey)\b |
  \bNSFile(?:CreationDate|ModificationDate|SystemFreeSize|SystemSize)\b |
  \bgetattrlist\w*\b | \b[fl]?stat(?:at|v?fs)?\s*\( |
  \bvolume\w*CapacityKey\b | \bsystem(?:Free)?Size\b |
  \bactiveInputModes\b
/x

podfile = File.join(RACINE, 'Podfile')
chemins_greffons = File.exist?(podfile) ? File.read(podfile).scan(/:path\s*=>\s*'([^']+)'/).flatten.uniq : []
signales = []
chemins_greffons.each do |relatif|
  Dir.glob(File.join(File.expand_path(relatif, RACINE), '**', '*.{swift,m,mm,h,c}')).sort.each do |source|
    File.foreach(source, encoding: 'UTF-8').with_index(1) do |ligne, n|
      ligne = ligne.scrub
      signales << "#{source}:#{n}: #{ligne.strip}" if ligne.match?(API_A_RAISON)
    end
  end
end
if signales.empty?
  etape("aucune API à raison déclarée dans les #{chemins_greffons.size} greffons du Podfile.")
else
  puts "::warning title=Manifeste de confidentialité::#{signales.size} appel(s) à des API à raison déclarée : " \
       'les déclarer dans app/ios-template/PrivacyInfo.xcprivacy.'
  signales.each { |s| puts "  #{s}" }
end

# ---------- 3. l'icône ----------

icone = File.join(ASSETS, 'AppIcon.appiconset')
FileUtils.rm_rf(icone)
FileUtils.mkdir_p(icone)
FileUtils.cp(File.join(ICI, 'AppIcon-1024.png'), File.join(icone, 'AppIcon-1024.png'))
File.write(File.join(icone, 'Contents.json'), JSON.pretty_generate(
  'images' => [{ 'filename' => 'AppIcon-1024.png', 'idiom' => 'universal', 'platform' => 'ios', 'size' => '1024x1024' }],
  'info' => { 'author' => 'xcode', 'version' => 1 }
) + "\n")
etape('icône 1024 posée.')

# ---------- 4. l'écran de lancement ----------

# Un PNG uni, sans transparence, écrit à la main : signature, IHDR, IDAT, IEND.
def png_uni(cote, rgb)
  morceau = lambda do |type, donnees|
    [donnees.bytesize].pack('N') + type + donnees + [Zlib.crc32(type + donnees)].pack('N')
  end
  ligne = "\x00".b + rgb.pack('C*') * cote
  "\x89PNG\r\n\x1a\n".b +
    morceau.call('IHDR', [cote, cote, 8, 2, 0, 0, 0].pack('NNCCCCC')) +
    morceau.call('IDAT', Zlib::Deflate.deflate(ligne * cote, Zlib::BEST_COMPRESSION)) +
    morceau.call('IEND', '')
end

ecran = File.join(ASSETS, 'Splash.imageset')
if Dir.exist?(ecran)
  papier = png_uni(2732, PAPIER)
  Dir.glob(File.join(ecran, '*.png')).each { |f| File.binwrite(f, papier) }
  etape('écran de lancement : papier de riz uni.')
end

# ---------- 5. Info.plist ----------

info = Xcodeproj::Plist.read_from_path(INFO)
info['ITSAppUsesNonExemptEncryption'] = false
info['UIUserInterfaceStyle'] = 'Light'
nom = info['CFBundleDisplayName'].to_s
echec("CFBundleDisplayName « #{nom} » : `cap add ios` n'a pas repris appName.") if nom.empty? || nom == 'My App'
Xcodeproj::Plist.write_to_path(info, INFO)
etape("Info.plist : ITSAppUsesNonExemptEncryption = false, UIUserInterfaceStyle = Light, nom affiché « #{nom} ».")
