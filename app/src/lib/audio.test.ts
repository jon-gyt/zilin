import { describe, it, expect, beforeEach } from 'vitest';
import { VERSION_DONNEES } from './content';
import {
  FICHIER_AUDIO,
  FICHIER_AUDIO_DEMO,
  FICHIERS_AUDIO,
  aAudio,
  aFichier,
  aVoixTelephone,
  direParLeTelephone,
  enonce,
  POINT_FINAL,
  voixMandarin,
  voixPretes,
  classerVoix,
  estContinent,
  jouerSon,
  qualiteVoix,
  reglerSession,
  reglerVoix,
  relireVoix,
  taire,
  vitesse,
  voixChoisie,
  voixParDefaut,
  type SyntheseNative,
  type VoixAppareil,
  type Synthese,
  chemin,
  configurerAudio,
  dire,
  lecteur,
  prononcer,
  loadManifeste,
  manifesteCharge,
  manifesteOnce,
  precharger,
  urlAudio,
  type Lecteur,
  type Manifeste
} from './audio';

const MANIFESTE: Manifeste = {
  version: '0.1.0',
  fournisseur: 'azure-speech',
  format: 'mp3',
  chemins: {
    人: 'data/0.1.0/audio/0123456789abcdef.mp3',
    天天: 'data/0.1.0/audio/fedcba9876543210.mp3'
  }
};

/** Un lecteur d'essai : il note ce qu'on lui demande, il ne joue rien. */
function lecteurDEssai(): Lecteur & { joues: string[] } {
  return {
    src: '',
    currentTime: 0,
    preload: '',
    joues: [] as string[],
    play(this: { src: string; joues: string[] }) {
      this.joues.push(this.src);
      return Promise.resolve();
    },
    pause() {}
  } as Lecteur & { joues: string[] };
}

/** Un `fetch` d'essai : il sert le manifeste et note les URL demandées. */
function fetchDEssai(urls: string[], document: unknown = MANIFESTE, ok = true): typeof fetch {
  return ((entree: RequestInfo | URL) => {
    urls.push(String(entree));
    return Promise.resolve({
      ok,
      status: ok ? 200 : 404,
      json: () => Promise.resolve(document)
    } as Response);
  }) as unknown as typeof fetch;
}

beforeEach(() => configurerAudio());

describe('le manifeste audio', () => {
  it('est chargé depuis le fichier servi avec l’app', async () => {
    const urls: string[] = [];
    const m = await loadManifeste(FICHIER_AUDIO, fetchDEssai(urls));
    expect(urls).toEqual([`${import.meta.env.BASE_URL}${FICHIER_AUDIO}`]);
    expect(m.version).toBe('0.1.0');
    expect(m.chemins['人']).toBe(MANIFESTE.chemins['人']);
  });

  it('n’est demandé qu’une fois, et se relit sans réseau', async () => {
    const urls: string[] = [];
    configurerAudio({ fetchFn: fetchDEssai(urls) });
    await manifesteOnce();
    await manifesteOnce();
    expect(urls).toHaveLength(1);
    expect(manifesteCharge()?.chemins['天天']).toBe(MANIFESTE.chemins['天天']);
  });

  it('absent, il ne fait pas d’erreur : l’app se tait', async () => {
    configurerAudio({ fetchFn: fetchDEssai([], null, false) });
    expect((await manifesteOnce()).chemins).toEqual({});
  });

  it('est celui de l’export versionné que lit l’app, la démonstration en repli', () => {
    expect(FICHIER_AUDIO).toBe(`data/${VERSION_DONNEES}/audio/manifeste.json`);
    expect(FICHIERS_AUDIO).toEqual([FICHIER_AUDIO, FICHIER_AUDIO_DEMO]);
  });

  it('se lit d’abord dans l’export, sans toucher à la démonstration', async () => {
    const urls: string[] = [];
    configurerAudio({ fetchFn: fetchDEssai(urls) });
    expect((await manifesteOnce()).chemins['人']).toBe(MANIFESTE.chemins['人']);
    expect(urls).toEqual([`${import.meta.env.BASE_URL}${FICHIER_AUDIO}`]);
  });

  it('sans audio dans l’export, se replie sur la démonstration', async () => {
    const urls: string[] = [];
    const DEMO: Manifeste = { ...MANIFESTE, version: 'demo', chemins: { 住: 'data/demo/audio/zhu.mp3' } };
    const fetchFn = ((entree: RequestInfo | URL) => {
      urls.push(String(entree));
      const demo = String(entree).endsWith(FICHIER_AUDIO_DEMO);
      return Promise.resolve({
        ok: demo,
        status: demo ? 200 : 404,
        json: () => Promise.resolve(demo ? DEMO : null)
      } as Response);
    }) as unknown as typeof fetch;
    configurerAudio({ fetchFn });
    const m = await manifesteOnce();
    expect(m.version).toBe('demo');
    expect(chemin(m, '住')).toBe('data/demo/audio/zhu.mp3');
    expect(urls).toEqual([
      `${import.meta.env.BASE_URL}${FICHIER_AUDIO}`,
      `${import.meta.env.BASE_URL}${FICHIER_AUDIO_DEMO}`
    ]);
  });

  it('dit si un texte a une voix, et laquelle', () => {
    expect(aAudio(MANIFESTE, '人')).toBe(true);
    expect(aAudio(MANIFESTE, '龘')).toBe(false);
    expect(aAudio(null, '人')).toBe(false);
    expect(chemin(MANIFESTE, '龘')).toBeNull();
  });
});

describe('dire', () => {
  it('compose le chemin du fichier avec la base de l’app', async () => {
    const l = lecteurDEssai();
    configurerAudio({ fetchFn: fetchDEssai([]), lecteur: () => l });
    expect(await dire('人')).toBe(true);
    expect(l.joues).toEqual([`${import.meta.env.BASE_URL}${MANIFESTE.chemins['人']}`]);
    expect(urlAudio('a/b.mp3')).toBe(`${import.meta.env.BASE_URL}a/b.mp3`);
  });

  it('ne fait rien, en silence, quand le texte n’a pas d’audio', async () => {
    const l = lecteurDEssai();
    configurerAudio({ fetchFn: fetchDEssai([]), lecteur: () => l });
    expect(await dire('龘')).toBe(false);
    expect(l.joues).toEqual([]);
    expect(l.src).toBe('');
  });

  it('n’utilise qu’un seul élément audio, réutilisé', async () => {
    let crees = 0;
    const l = lecteurDEssai();
    configurerAudio({
      fetchFn: fetchDEssai([]),
      lecteur: () => {
        crees += 1;
        return l;
      }
    });
    await dire('人');
    await dire('天天');
    expect(crees).toBe(1);
    expect(lecteur()).toBe(l);
    expect(l.joues).toHaveLength(2);
  });

  it('se tait plutôt que d’échouer quand la lecture est refusée', async () => {
    const refus: Lecteur = {
      src: '',
      currentTime: 0,
      preload: '',
      play: () => Promise.reject(new Error('geste requis')),
      pause() {}
    } as Lecteur;
    configurerAudio({ fetchFn: fetchDEssai([]), lecteur: () => refus });
    await expect(dire('人')).resolves.toBe(false);
  });

  it('sans lecteur (hors navigateur), ne fait rien', async () => {
    configurerAudio({ fetchFn: fetchDEssai([]), lecteur: () => null });
    expect(await dire('人')).toBe(false);
  });
});

describe('le préchargement', () => {
  it('ne va chercher que les textes qui ont une voix', async () => {
    const urls: string[] = [];
    configurerAudio({ fetchFn: fetchDEssai(urls) });
    expect(await precharger(['人', '龘'])).toBe(1);
    expect(urls).toEqual([
      `${import.meta.env.BASE_URL}${FICHIER_AUDIO}`,
      `${import.meta.env.BASE_URL}${MANIFESTE.chemins['人']}`
    ]);
  });
});

/** Une synthèse d'essai : des voix, et la liste de ce qu'on lui a fait dire. */
function syntheseDEssai(langs: string[]): Synthese & { dits: string[]; annulations: number } {
  const dits: string[] = [];
  const s = {
    dits,
    annulations: 0,
    getVoices: () => langs.map((lang) => ({ lang, name: lang, voiceURI: lang, default: false, localService: true })),
    speak: (u: SpeechSynthesisUtterance) => { dits.push(u.text); },
    cancel() { s.annulations += 1; }
  };
  return s as unknown as Synthese & { dits: string[]; annulations: number };
}

class UtteranceDEssai {
  text: string;
  voice: unknown = null;
  lang = '';
  rate = 1;
  constructor(text: string) { this.text = text; }
}

describe('la voix du téléphone en repli', () => {
  beforeEach(() => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = UtteranceDEssai;
  });

  it('préfère le mandarin standard et écarte le cantonais', () => {
    configurerAudio({ synthese: () => syntheseDEssai(['en-US', 'zh-HK', 'zh-TW', 'zh-CN']) });
    expect(voixMandarin()?.lang).toBe('zh-CN');
    configurerAudio({ synthese: () => syntheseDEssai(['zh-HK', 'zh-TW']) });
    expect(voixMandarin()?.lang).toBe('zh-TW');
    configurerAudio({ synthese: () => syntheseDEssai(['zh-HK', 'fr-FR']) });
    expect(aVoixTelephone()).toBe(false);
  });

  it("dit par le téléphone un texte sans fichier, et rend le bouton actif", async () => {
    const s = syntheseDEssai(['zh-CN']);
    const l = lecteurDEssai();
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: async () => ({ ok: true, json: async () => MANIFESTE }) as Response });
    expect(aFichier(MANIFESTE, '住')).toBe(false);
    expect(aAudio(MANIFESTE, '住')).toBe(true);
    expect(await dire('住')).toBe(true);
    expect(s.dits).toEqual(['住。']);
    expect(s.annulations).toBeGreaterThanOrEqual(1);
    expect(l.joues).toEqual([]);
  });

  it('« Voix enregistrée » : joue le fichier quand il existe, sans passer par le téléphone', async () => {
    const s = syntheseDEssai(['zh-CN']);
    const l = lecteurDEssai();
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: async () => ({ ok: true, json: async () => MANIFESTE }) as Response });
    reglerVoix('enregistree');
    expect(await dire('人')).toBe(true);
    expect(l.joues).toHaveLength(1);
    expect(s.dits).toEqual([]);
  });

  it('se tait sans fichier ni voix mandarin', async () => {
    configurerAudio({ synthese: () => null, lecteur: () => lecteurDEssai(), fetchFn: async () => ({ ok: true, json: async () => MANIFESTE }) as Response });
    expect(aAudio(MANIFESTE, '住')).toBe(false);
    expect(await dire('住')).toBe(false);
    expect(direParLeTelephone('住')).toBe(false);
  });
});

/** Un lecteur dont `play()` rejette avec l'erreur nommée, comme le fait un navigateur. */
function lecteurQuiEchoue(nom: string): Lecteur & { essais: number } {
  const l = {
    src: '',
    currentTime: 0,
    preload: '',
    essais: 0,
    play() {
      l.essais += 1;
      return Promise.reject(Object.assign(new Error(nom), { name: nom }));
    },
    pause() {}
  };
  return l as unknown as Lecteur & { essais: number };
}

describe('un fichier qui ne se charge pas', () => {
  beforeEach(() => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = UtteranceDEssai;
  });

  it('joue le fichier quand il se charge', async () => {
    configurerAudio({ synthese: () => null, lecteur: () => lecteurDEssai(), fetchFn: fetchDEssai([]) });
    expect(await prononcer('人')).toBe('fichier');
  });

  it('hors ligne et pas en cache, retombe sur la voix de l’appareil', async () => {
    const s = syntheseDEssai(['zh-CN']);
    const l = lecteurQuiEchoue('NotSupportedError');
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: fetchDEssai([]) });
    reglerVoix('enregistree');
    expect(await prononcer('人')).toBe('telephone');
    expect(l.essais).toBe(1);
    expect(s.dits).toEqual(['人。']);
    expect(await dire('人')).toBe(true);
  });

  it('sans voix de l’appareil, rien n’est dit : la question à l’oreille passe', async () => {
    configurerAudio({ synthese: () => null, lecteur: () => lecteurQuiEchoue('NotSupportedError'), fetchFn: fetchDEssai([]) });
    expect(await prononcer('人')).toBe('muet');
    expect(await dire('人')).toBe(false);
  });

  it('un refus du navigateur (geste requis) ne vaut pas un fichier absent', async () => {
    configurerAudio({ synthese: () => null, lecteur: () => lecteurQuiEchoue('NotAllowedError'), fetchFn: fetchDEssai([]) });
    expect(await prononcer('人')).toBe('bloque');
    configurerAudio({ synthese: () => null, lecteur: () => lecteurQuiEchoue('AbortError'), fetchFn: fetchDEssai([]) });
    expect(await prononcer('人')).toBe('bloque');
  });

  it('sans fichier ni voix, muet', async () => {
    configurerAudio({ synthese: () => null, lecteur: () => lecteurDEssai(), fetchFn: fetchDEssai([]) });
    expect(await prononcer('住')).toBe('muet');
  });
});

describe('les voix du téléphone, une fois annoncées', () => {
  it('répond tout de suite quand les voix sont déjà là', async () => {
    configurerAudio({ synthese: () => syntheseDEssai(['zh-CN']) });
    expect(await voixPretes()).toBe(true);
    configurerAudio({ synthese: () => syntheseDEssai(['fr-FR']) });
    expect(await voixPretes()).toBe(false);
    configurerAudio({ synthese: () => null });
    expect(await voixPretes()).toBe(false);
  });

  it('attend l’annonce des voix (voiceschanged) quand la liste est vide au premier appel', async () => {
    let langs: string[] = [];
    const ecouteurs: (() => void)[] = [];
    const s = {
      getVoices: () =>
        langs.map((lang) => ({ lang, name: lang, voiceURI: lang, default: false, localService: true })),
      speak: () => {},
      cancel: () => {},
      addEventListener: (_t: string, f: () => void) => ecouteurs.push(f),
      removeEventListener: () => {}
    } as unknown as Synthese;
    configurerAudio({ synthese: () => s });
    const p = voixPretes(10_000);
    langs = ['zh-CN'];
    ecouteurs.forEach((f) => f());
    expect(await p).toBe(true);
  });

  it('ne l’attend pas indéfiniment : sans annonce, pas de voix', async () => {
    const s = {
      getVoices: () => [],
      speak: () => {},
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    } as unknown as Synthese;
    configurerAudio({ synthese: () => s });
    expect(await voixPretes(5)).toBe(false);
  });
});

/* ---------- la voix de référence (brief §7, décision du 29 septembre 2026) ---------- */

/** Une voix de l'appareil, comme `speechSynthesis` ou AVSpeechSynthesizer la décrivent. */
function voix(lang: string, voiceURI = lang, localService = true, name = voiceURI): VoixAppareil {
  return { lang, name, voiceURI, localService, default: false };
}

/** Une synthèse d'essai qui rend des voix complètes (identifiant, service). */
function syntheseDeVoix(liste: VoixAppareil[]): Synthese & { dits: { text: string; rate: number; uri: string }[]; annulations: number } {
  const dits: { text: string; rate: number; uri: string }[] = [];
  const s = {
    dits,
    annulations: 0,
    getVoices: () => liste,
    speak: (u: SpeechSynthesisUtterance) => {
      dits.push({ text: u.text, rate: u.rate, uri: (u.voice as VoixAppareil | null)?.voiceURI ?? '' });
    },
    cancel() {
      s.annulations += 1;
    }
  };
  return s as unknown as Synthese & { dits: { text: string; rate: number; uri: string }[]; annulations: number };
}

const APPLE = [
  voix('zh-TW', 'com.apple.voice.premium.zh-TW.Meijia'),
  voix('zh-HK', 'com.apple.voice.premium.zh-HK.Sinji'),
  voix('zh-CN', 'com.apple.voice.compact.zh-CN.Tingting'),
  voix('zh-CN', 'com.apple.voice.enhanced.zh-CN.Tingting'),
  voix('zh-CN', 'com.apple.voice.premium.zh-CN.Lilian'),
  voix('en-US', 'com.apple.voice.premium.en-US.Zoe')
];

describe('la voix de l’appareil, classée', () => {
  beforeEach(() => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = UtteranceDEssai;
  });

  it('Premium avant Améliorée avant compacte, d’après l’identifiant d’Apple', () => {
    expect(qualiteVoix(voix('zh-CN', 'com.apple.voice.premium.zh-CN.Lilian'))).toBe(3);
    expect(qualiteVoix(voix('zh-CN', 'com.apple.voice.enhanced.zh-CN.Tingting'))).toBe(2);
    expect(qualiteVoix(voix('zh-CN', 'x', true, 'Tingting (Améliorée)'))).toBe(2);
    expect(qualiteVoix(voix('zh-CN', 'com.apple.voice.compact.zh-CN.Tingting'))).toBe(0);
    expect(classerVoix(APPLE).map((v) => v.voiceURI)).toEqual([
      'com.apple.voice.premium.zh-CN.Lilian',
      'com.apple.voice.enhanced.zh-CN.Tingting',
      'com.apple.voice.compact.zh-CN.Tingting',
      'com.apple.voice.premium.zh-TW.Meijia'
    ]);
  });

  it('le continent avant Taïwan, même moins bonne ; jamais le cantonais de Hong Kong', () => {
    const l = [voix('zh-TW', 'com.apple.voice.premium.zh-TW.Meijia'), voix('zh_CN', 'com.apple.voice.compact.zh-CN.Tingting'), voix('yue-HK')];
    expect(classerVoix(l)[0].lang).toBe('zh_CN');
    expect(classerVoix([voix('zh-HK'), voix('yue-Hant-HK')])).toEqual([]);
    expect(estContinent(voix('zh-Hans-CN'))).toBe(true);
    expect(estContinent(voix('zh-TW'))).toBe(false);
  });

  it('jamais une voix qui passe par un service : pas de réseau à l’exécution', () => {
    const l = [voix('zh-CN', 'Google 普通话（中国大陆）', false), voix('zh-CN', 'Microsoft Huihui')];
    expect(classerVoix(l).map((v) => v.voiceURI)).toEqual(['Microsoft Huihui']);
    configurerAudio({ synthese: () => syntheseDeVoix([voix('zh-CN', 'Google 普通话（中国大陆）', false)]) });
    expect(aVoixTelephone()).toBe(false);
  });

  it('la voix de l’appareil par défaut quand il a une voix du continent, sinon les fichiers', () => {
    configurerAudio({ synthese: () => syntheseDeVoix(APPLE) });
    expect(voixParDefaut()).toBe('appareil');
    expect(voixChoisie()).toBe('appareil');
    configurerAudio({ synthese: () => syntheseDeVoix([voix('zh-TW')]) });
    expect(voixParDefaut()).toBe('enregistree');
    configurerAudio({ synthese: () => null });
    expect(voixParDefaut()).toBe('enregistree');
    reglerVoix('appareil');
    expect(voixChoisie()).toBe('enregistree');
  });

  it('par défaut, « Écouter » dit le caractère par la voix Premium, un peu lentement, sans le fichier', async () => {
    const s = syntheseDeVoix(APPLE);
    const l = lecteurDEssai();
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: fetchDEssai([]) });
    expect(await prononcer('人')).toBe('telephone');
    expect(l.joues).toEqual([]);
    expect(s.dits).toEqual([{ text: '人。', rate: vitesse('人'), uri: 'com.apple.voice.premium.zh-CN.Lilian' }]);
    expect(vitesse('人')).toBeLessThan(vitesse('天天'));
    expect(vitesse('天天')).toBeLessThan(1);
  });

  it('« Voix enregistrée » : le fichier d’abord, la voix de l’appareil en repli', async () => {
    const s = syntheseDeVoix(APPLE);
    const l = lecteurDEssai();
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: fetchDEssai([]) });
    reglerVoix('enregistree');
    expect(await prononcer('人')).toBe('fichier');
    expect(await prononcer('住')).toBe('telephone');
    expect(s.dits.map((d) => d.text)).toEqual(['住。']);
  });

  it('dans l’app iOS, la voix passe par AVSpeechSynthesizer, nommée par son rang, session en lecture', async () => {
    const dits: [string, string, number][] = [];
    const n: SyntheseNative = {
      voix: async () => APPLE,
      dire: async (t, lang, rang) => {
        dits.push([t, lang, rang]);
      },
      taire: async () => undefined
    };
    const session = { type: 'play-and-record' };
    const web = syntheseDeVoix([]);
    configurerAudio({ synthese: () => web, natif: () => n, session: () => session, fetchFn: fetchDEssai([]), lecteur: () => lecteurDEssai() });
    expect(await voixPretes()).toBe(true);
    expect(voixMandarin()?.voiceURI).toBe('com.apple.voice.premium.zh-CN.Lilian');
    expect(await prononcer('人')).toBe('telephone');
    expect(dits).toEqual([['人。', 'zh-CN', 4]]);
    expect(session.type).toBe('playback');
    expect(web.dits).toEqual([]);
  });

  it('une voix téléchargée pendant que l’app est ouverte est prise en rouvrant Réglages', async () => {
    let liste: VoixAppareil[] = [voix('zh-CN', 'com.apple.voice.compact.zh-CN.Tingting')];
    const n: SyntheseNative = { voix: async () => liste, dire: async () => undefined, taire: async () => undefined };
    configurerAudio({ natif: () => n, synthese: () => null });
    await voixPretes();
    expect(qualiteVoix(voixMandarin() as VoixAppareil)).toBe(0);
    liste = APPLE;
    await relireVoix();
    expect(qualiteVoix(voixMandarin() as VoixAppareil)).toBe(3);
  });
});

/**
 * Un lecteur comme celui d'un navigateur : `play()` attend le chargement, et changer `src`
 * pendant ce temps fait rejeter la lecture en cours (`AbortError`).
 */
function lecteurLent(): Lecteur & { joues: string[]; pauses: number; charger: () => void } {
  let enCours: { resoudre: () => void; rejeter: (e: unknown) => void } | null = null;
  let src = '';
  const l = {
    joues: [] as string[],
    pauses: 0,
    currentTime: 0,
    preload: '',
    get src() {
      return src;
    },
    set src(v: string) {
      src = v;
      enCours?.rejeter(Object.assign(new Error('interrompue'), { name: 'AbortError' }));
      enCours = null;
    },
    play() {
      return new Promise<void>((resoudre, rejeter) => {
        enCours = {
          resoudre: () => {
            l.joues.push(src);
            resoudre();
          },
          rejeter
        };
      });
    },
    pause() {
      l.pauses += 1;
    },
    charger() {
      enCours?.resoudre();
      enCours = null;
    }
  };
  return l as unknown as Lecteur & { joues: string[]; pauses: number; charger: () => void };
}

describe('un seul son à la fois', () => {
  beforeEach(() => {
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = UtteranceDEssai;
  });

  it('deux « Écouter » rapprochés : la voix de l’appareil ne parle pas par-dessus le fichier', async () => {
    const s = syntheseDeVoix(APPLE);
    const l = lecteurLent();
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: fetchDEssai([]) });
    reglerVoix('enregistree');
    const premier = prononcer('人');
    await manifesteOnce();
    await Promise.resolve();
    const second = prononcer('人');
    await manifesteOnce();
    await Promise.resolve();
    l.charger();
    expect(await premier).toBe('bloque');
    expect(await second).toBe('fichier');
    expect(s.dits).toEqual([]);
    expect(l.joues).toHaveLength(1);
  });

  it('chaque demande fait taire ce qui jouait : le fichier et la voix de l’appareil', async () => {
    const s = syntheseDeVoix(APPLE);
    const l = lecteurDEssai() as Lecteur & { joues: string[] } & { pauses?: number };
    let pauses = 0;
    l.pause = () => {
      pauses += 1;
    };
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: fetchDEssai([]) });
    reglerVoix('enregistree');
    await prononcer('人');
    const avant = s.annulations;
    await prononcer('住');
    expect(pauses).toBeGreaterThanOrEqual(1);
    expect(s.annulations).toBeGreaterThan(avant);
    taire();
    expect(pauses).toBeGreaterThanOrEqual(2);
  });

  it('« Réécouter » joue un son en mémoire sur le même lecteur, et fait taire la voix', async () => {
    const s = syntheseDeVoix(APPLE);
    const l = lecteurDEssai();
    configurerAudio({ synthese: () => s, lecteur: () => l });
    const avant = s.annulations;
    expect(await jouerSon('blob:wenlu/voix')).toBe(true);
    expect(l.joues).toEqual(['blob:wenlu/voix']);
    expect(s.annulations).toBe(avant + 1);
  });
});

/** Les caractères chinois d'un texte, dans l'ordre : ce qui se prononce. */
function hanzi(t: string): string {
  return [...t].filter((x) => /\p{Script=Han}/u.test(x)).join('');
}

describe('l’énoncé : un caractère seul n’est pas coupé net', () => {
  it('un caractère seul finit sur un point final, qui lui donne sa chute', () => {
    expect(enonce('人')).toBe('人。');
    expect(enonce('好')).toBe(`好${POINT_FINAL}`);
    expect(enonce('天天')).toBe('天天。');
  });

  it('un texte qui finit déjà sur une ponctuation finale reste tel quel', () => {
    expect(enonce('你好。')).toBe('你好。');
    expect(enonce('你好吗？')).toBe('你好吗？');
    expect(enonce('太好了！')).toBe('太好了！');
    expect(enonce('他说：「好。」')).toBe('他说：「好。」');
    expect(enonce('好啊……')).toBe('好啊……');
  });

  it('une virgule ou une espace finale devient un point', () => {
    expect(enonce(' 人 ')).toBe('人。');
    expect(enonce('你好，')).toBe('你好。');
    expect(enonce('春、')).toBe('春。');
  });

  it('ne change jamais ce qui se prononce : aucun mot ajouté, aucun retiré', () => {
    for (const t of ['人', '天天', '叶公好龙', '你好，', '你好吗？', '他说：「好。」', '一', '了']) {
      expect(hanzi(enonce(t))).toBe(hanzi(t));
      expect(enonce(t).startsWith(t.trim().replace(/[，、]$/u, ''))).toBe(true);
    }
    expect(enonce('')).toBe('');
    expect(enonce('，')).toBe('，');
  });

  it('la voix du web reçoit le point final, à la vitesse du caractère seul', async () => {
    const s = syntheseDeVoix(APPLE);
    configurerAudio({ synthese: () => s, fetchFn: fetchDEssai([]) });
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = UtteranceDEssai;
    await prononcer('人');
    expect(s.dits).toEqual([{ text: '人。', rate: vitesse('人'), uri: 'com.apple.voice.premium.zh-CN.Lilian' }]);
    expect(vitesse('人')).toBe(0.75);
  });

  it('la voix native aussi', async () => {
    const dits: string[] = [];
    const n: SyntheseNative = { voix: async () => APPLE, dire: async (t) => void dits.push(t), taire: async () => undefined };
    configurerAudio({ natif: () => n, synthese: () => null, fetchFn: fetchDEssai([]) });
    await voixPretes();
    await prononcer('好');
    expect(dits).toEqual(['好。']);
  });
});

describe('la session audio', () => {
  it('se règle quand le navigateur la laisse régler (Safari 17 et plus), sinon rien', () => {
    const session = { type: 'auto' };
    configurerAudio({ session: () => session });
    expect(reglerSession('play-and-record')).toBe(true);
    expect(session.type).toBe('play-and-record');
    expect(reglerSession('playback')).toBe(true);
    expect(session.type).toBe('playback');
    configurerAudio({ session: () => null });
    expect(reglerSession('playback')).toBe(false);
  });
});

