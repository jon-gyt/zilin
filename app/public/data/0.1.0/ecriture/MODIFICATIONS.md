# Gabarits d'écriture dérivés de Make Me a Hanzi

Version de l'export : 0.1.0. Dérivés le 2026-09-29.

Source : Make Me a Hanzi — graphics.txt (médianes), https://github.com/skishore/makemeahanzi
Licence : Arphic Public License, texte intégral et inaltéré dans `ARPHICPL.TXT`.

## Modifications apportées

- Sous-ensemble : 3000 caractères, ceux du HSK 3.0 (GF 0025-2021, niveaux 1 à 9).
- Seules les médianes sont reprises ; les tracés (contours) sont omis.
- L'axe vertical est retourné : y croît vers le bas, comme sur un écran.
- Chaque médiane est rééchantillonnée à 8 points également espacés le long du trait, extrémités comprises.
- La boîte des points du caractère est centrée et divisée par son plus grand côté, puis chaque coordonnée est arrondie au plus proche de 64 crans et écrite en un signe de l'alphabet base64 des URL (RFC 4648 §5).

Le fichier porte la même mention dans son en-tête (`license`, `source`, `source_url`, `modified`), comme l'exige l'APL §2 a). Il sert à reconnaître un caractère tracé au doigt ; aucun caractère n'est dessiné depuis ces gabarits.
