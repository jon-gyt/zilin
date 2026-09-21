/**
 * Le thème : celui du système, ou le clair, ou le sombre. C'est un réglage d'affichage,
 * pas de la progression : il reste dans le stockage local et ne part pas à l'export.
 *
 * `auto` retire l'attribut et laisse `prefers-color-scheme` décider ; `light` et `dark`
 * le posent sur `<html>`, comme `tokens.css` l'attend.
 */
export type Theme = 'auto' | 'light' | 'dark';

export const THEMES: { id: Theme; t: string }[] = [
  { id: 'light', t: 'Clair' },
  { id: 'auto', t: 'Système' },
  { id: 'dark', t: 'Sombre' }
];

const CLE = 'zilin-theme';

function estTheme(v: unknown): v is Theme {
  return v === 'auto' || v === 'light' || v === 'dark';
}

/** Pose le thème sur la racine du document. Fonction pure côté données. */
export function appliquerTheme(t: Theme, racine: HTMLElement): void {
  if (t === 'auto') racine.removeAttribute('data-theme');
  else racine.setAttribute('data-theme', t);
}

/** Relit le thème choisi. `auto` par défaut, et si le stockage est indisponible. */
export function lireTheme(): Theme {
  try {
    const v = localStorage.getItem(CLE);
    return estTheme(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Garde le thème choisi, et l'applique. Un stockage indisponible n'empêche rien. */
export function ecrireTheme(t: Theme): void {
  try {
    localStorage.setItem(CLE, t);
  } catch {
    /* stockage indisponible : le thème vaut pour la session en cours */
  }
  if (typeof document !== 'undefined') appliquerTheme(t, document.documentElement);
}

/** Au démarrage : le thème gardé est posé avant le premier écran. */
export function initTheme(): void {
  if (typeof document !== 'undefined') appliquerTheme(lireTheme(), document.documentElement);
}
