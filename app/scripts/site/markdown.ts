/**
 * Un rendu Markdown réduit, juste assez pour `LICENCES.md` de l'export : titres,
 * paragraphes, listes à puces, tableaux, `code` en ligne et URL nues. Le texte est
 * échappé ; rien n'est interprété comme HTML.
 */

export function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function enLigne(s: string): string {
  return echapper(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])(https:\/\/[^\s<)]+[^\s<).,;])/g, '$1<a href="$2" rel="noopener">$2</a>');
}

function cellules(ligne: string): string[] {
  return ligne.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** `decalage` abaisse les titres : `#` devient `h(1 + decalage)`. */
export function markdown(md: string, decalage = 1): string {
  const lignes = md.replace(/\r\n/g, '\n').split('\n');
  const sortie: string[] = [];
  let i = 0;
  while (i < lignes.length) {
    const l = lignes[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    const titre = /^(#{1,6})\s+(.*)$/.exec(l);
    if (titre) {
      const n = Math.min(6, titre[1].length + decalage);
      sortie.push(`<h${n}>${enLigne(titre[2])}</h${n}>`);
      i++;
      continue;
    }
    if (l.trimStart().startsWith('|')) {
      const bloc: string[] = [];
      while (i < lignes.length && lignes[i].trimStart().startsWith('|')) bloc.push(lignes[i++]);
      const [entete, , ...corps] = bloc;
      const th = cellules(entete).map((c) => `<th scope="col">${enLigne(c)}</th>`).join('');
      const tr = corps.map((r) => `<tr>${cellules(r).map((c) => `<td>${enLigne(c)}</td>`).join('')}</tr>`).join('');
      sortie.push(`<div class="defile"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lignes.length && lignes[i].trim()) {
        if (/^\s*[-*]\s+/.test(lignes[i])) items.push(lignes[i].replace(/^\s*[-*]\s+/, ''));
        else items[items.length - 1] += ` ${lignes[i].trim()}`;
        i++;
      }
      sortie.push(`<ul>${items.map((t) => `<li>${enLigne(t)}</li>`).join('')}</ul>`);
      continue;
    }
    const para: string[] = [];
    while (i < lignes.length && lignes[i].trim() && !/^(#|\||\s*[-*]\s)/.test(lignes[i])) para.push(lignes[i++].trim());
    sortie.push(`<p>${enLigne(para.join(' '))}</p>`);
  }
  return sortie.join('\n');
}
