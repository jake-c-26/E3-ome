# E3 ORCS Atlas Website

Open `index.html` in a browser to explore the BioGRID ORCS E3 scores.

The site is static and dependency-free:

- `index.html`: page structure
- `styles.css`: visual design
- `app.js`: filtering, charts, cards, and detail panel
- `data.js`: browser-friendly copy of `../e3_biogrid_orcs_scores.json`

To refresh the site after rebuilding the scores:

```bash
python3 -c "import json, pathlib; src=pathlib.Path('../e3_biogrid_orcs_scores.json'); dst=pathlib.Path('data.js'); data=json.load(src.open()); dst.write_text('window.E3_ORCS_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\\n')"
```

Run that command from this `e3_orcs_atlas` folder.
