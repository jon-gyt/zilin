import { describe, it, expect, beforeEach } from 'vitest';
import {
  FICHIER_AUDIO,
  aAudio,
  chemin,
  configurerAudio,
  dire,
  lecteur,
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
