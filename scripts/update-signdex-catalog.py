"""Refresh the bundled species/type catalogue from the official PokéAPI dataset."""
import csv
import io
import json
from pathlib import Path
from subprocess import check_output
from concurrent.futures import ThreadPoolExecutor

BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
FILES = ['pokemon_species.csv', 'pokemon.csv', 'pokemon_types.csv', 'types.csv']
def fetch(name):
    payload = check_output(['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '30', BASE + name], timeout=35)
    return name, list(csv.DictReader(io.StringIO(payload.decode())))
with ThreadPoolExecutor(max_workers=4) as pool:
    data = dict(pool.map(fetch, FILES))
types = {row['id']: row['identifier'] for row in data['types.csv']}
primary = {row['pokemon_id']: types[row['type_id']] for row in data['pokemon_types.csv'] if row['slot'] == '1'}
defaults = {row['species_id']: row['id'] for row in data['pokemon.csv'] if row['is_default'] == '1'}
exceptions = {'nidoran-f': 'Nidoran ♀', 'nidoran-m': 'Nidoran ♂', 'mr-mime': 'Mr. Mime', 'mime-jr': 'Mime Jr.', 'farfetchd': 'Farfetch’d', 'sirfetchd': 'Sirfetch’d', 'type-null': 'Type: Null', 'porygon-z': 'Porygon-Z', 'ho-oh': 'Ho-Oh', 'mr-rime': 'Mr. Rime', 'jangmo-o': 'Jangmo-o', 'hakamo-o': 'Hakamo-o', 'kommo-o': 'Kommo-o'}
pokemon = [{'id': row['identifier'], 'name': exceptions.get(row['identifier'], row['identifier'].replace('-', ' ').title()), 'number': int(row['id']), 'type': primary[defaults[row['id']]]} for row in data['pokemon_species.csv'] if row['id'] in defaults]
output = Path(__file__).resolve().parents[1] / 'assets/js/signdex-pokemon.js'
output.write_text('// Species and primary types from https://github.com/PokeAPI/pokeapi (see docs/signdex.md).\n' + 'globalThis.SignDexPokemon = ' + json.dumps(pokemon, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Bundled {len(pokemon)} Pokémon species and their primary types.')
