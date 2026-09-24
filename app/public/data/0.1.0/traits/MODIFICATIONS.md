# Tracés dérivés de Make Me a Hanzi

Version de l'export : 0.1.0. Dérivés le 2026-09-24.

Source : Make Me a Hanzi — graphics.txt, https://github.com/skishore/makemeahanzi
Licence : Arphic Public License, texte intégral et inaltéré dans `ARPHICPL.TXT`.

## Modifications apportées

- Conversion de format : les lignes JSON de `graphics.txt` deviennent un fichier par famille, `{"<caractère>": {"s": [tracés], "m": [médianes]}}`.
- Sous-ensemble : 480 caractères seulement — le seuil 255, le HSK 1, les caractères dessinés des fêtes et leurs briques.
- Les tracés et les médianes ne sont pas retouchés : ni arrondi, ni simplification, ni renommage.

Chaque fichier de ce dossier porte la même mention dans son en-tête (`license`, `source`, `source_url`, `modified`), comme l'exige l'APL §2 a).
