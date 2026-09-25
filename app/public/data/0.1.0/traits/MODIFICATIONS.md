# Tracés dérivés de Make Me a Hanzi

Version de l'export : 0.1.0. Dérivés le 2026-09-25.

Source : Make Me a Hanzi — graphics.txt, https://github.com/skishore/makemeahanzi
Licence : Arphic Public License, texte intégral et inaltéré dans `ARPHICPL.TXT`.

## Modifications apportées

- Conversion de format : les lignes JSON de `graphics.txt` deviennent un fichier par famille, `{"<caractère>": {"s": [tracés], "m": [médianes]}}`.
- Sous-ensemble : 566 caractères seulement — le seuil 255, le HSK 1, les caractères dessinés des fêtes, des termes solaires et des mots expliqués des contes, et leurs briques.
- Les tracés et les médianes ne sont pas retouchés — ni arrondi, ni simplification, ni renommage —, hors les composants découpés décrits ci-dessous.

## Composants découpés dans un caractère hôte

13 composants de la norme GF 0014-2009 n'ont pas de tracé propre dans `graphics.txt`. Leurs tracés et leurs médianes sont ceux d'un caractère hôte qui les contient, réduits aux seuls traits désignés, dans l'ordre d'écriture de l'hôte ; aucun trait n'est dessiné ni retouché. Seule transformation : un recadrage dans la boîte de 1024, l'homothétie x' = e·x + dx, y' = e·y + dy appliquée à chaque coordonnée des tracés et des médianes, puis arrondie à l'entier. Elle porte la boîte englobante des traits retenus au centre (512 ; 388), son plus grand côté à 760 unités, sans agrandir plus de 2 fois. Table versionnée : `data/sources/surcharges/decoupes.tsv` du dépôt.

| Composant | Hôte | Traits de l'hôte retenus (à partir de 0) | e | dx | dy |
|---|---|---|---|---|---|
| ⿰𠄌丶 | 以 | 0, 1 (sur 4) | 1,3194 | 33,1 | −160,9 |
| ⿰丿丨 | 介 | 2, 3 (sur 4) | 1,2838 | −4,7 | 126,1 |
| 䒑 | 喜 | 6, 7, 8 (sur 12) | 0,8706 | 60,6 | 116,4 |
| 龰 | 足 | 3, 4, 5, 6 (sur 7) | 0,8696 | 62,4 | 128,4 |
| 龴 | 令 | 3, 4 (sur 5) | 1,6068 | −253,6 | 122,1 |
| 𠀎 | 寒 | 3, 4, 5, 6, 7 (sur 12) | 1,2583 | −139,8 | −217,2 |
| 𠂇 | 左 | 0, 1 (sur 5) | 0,9383 | 118,4 | −21,1 |
| 𠂉 | 乞 | 0, 1 (sur 3) | 1,2479 | −52,7 | −438,7 |
| 𠂒 | 先 | 0, 1, 2, 3 (sur 6) | 1,1326 | −60,5 | −273,4 |
| 𠃊 | 喝 | 11 (sur 12) | 1,9289 | −550,8 | −29,6 |
| 𡗗 | 春 | 0, 1, 2, 3, 4 (sur 9) | 0,8444 | 53,5 | −40,5 |
| 𭃂 | 那 | 0, 1, 2, 3 (sur 6) | 1,1603 | 163,9 | −139,4 |
| 𭕄 | 学 | 0, 1, 2, 3, 4 (sur 8) | 0,9806 | 5,5 | −193 |

Chaque fichier de ce dossier porte la même mention dans son en-tête (`license`, `source`, `source_url`, `modified`), comme l'exige l'APL §2 a).
