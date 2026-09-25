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
  voixMandarin,
  voixPretes,
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
    expect(s.dits).toEqual(['住']);
    expect(s.annulations).toBe(1);
    expect(l.joues).toEqual([]);
  });

  it('joue le fichier quand il existe, sans passer par le téléphone', async () => {
    const s = syntheseDEssai(['zh-CN']);
    const l = lecteurDEssai();
    configurerAudio({ synthese: () => s, lecteur: () => l, fetchFn: async () => ({ ok: true, json: async () => MANIFESTE }) as Response });
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
    expect(await prononcer('人')).toBe('telephone');
    expect(l.essais).toBe(1);
    expect(s.dits).toEqual(['人']);
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
