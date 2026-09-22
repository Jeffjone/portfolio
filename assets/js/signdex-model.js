/* Shared rules run both in the browser and in the SignDex API. */
(() => {
  'use strict';
  const games = [
    ['red','Red','Kanto'],['blue','Blue','Kanto'],['yellow','Yellow','Kanto'],
    ['gold','Gold','Johto'],['silver','Silver','Johto'],['crystal','Crystal','Johto'],
    ['ruby','Ruby','Hoenn'],['sapphire','Sapphire','Hoenn'],['emerald','Emerald','Hoenn'],
    ['firered','FireRed','Kanto'],['leafgreen','LeafGreen','Kanto'],
    ['diamond','Diamond','Sinnoh'],['pearl','Pearl','Sinnoh'],['platinum','Platinum','Sinnoh'],
    ['heartgold','HeartGold','Johto'],['soulsilver','SoulSilver','Johto'],
    ['black','Black','Unova'],['white','White','Unova'],['black-2','Black 2','Unova'],['white-2','White 2','Unova'],
    ['x','X','Kalos'],['y','Y','Kalos'],['omega-ruby','Omega Ruby','Hoenn'],['alpha-sapphire','Alpha Sapphire','Hoenn'],
    ['sun','Sun','Alola'],['moon','Moon','Alola'],['ultra-sun','Ultra Sun','Alola'],['ultra-moon','Ultra Moon','Alola'],
    ['lets-go-pikachu','Let’s Go, Pikachu!','Kanto'],['lets-go-eevee','Let’s Go, Eevee!','Kanto'],
    ['sword','Sword','Galar'],['shield','Shield','Galar'],['brilliant-diamond','Brilliant Diamond','Sinnoh'],['shining-pearl','Shining Pearl','Sinnoh'],
    ['legends-arceus','Legends: Arceus','Hisui'],['scarlet','Scarlet','Paldea'],['violet','Violet','Paldea'],['legends-za','Legends: Z-A','Kalos'],
    ['go','Pokémon GO','Outdoors'],['snap','Pokémon Snap / New Pokémon Snap','Photo safari'],['mystery-dungeon','Mystery Dungeon series','Rescue team'],
    ['ranger','Pokémon Ranger series','Ranger station'],['other','Another Pokémon game','Uncharted route'],['new','I haven’t played yet','First steps']
  ].map(([id,name,region]) => ({id,name,region}));
  const series = [
    ['original','Original series (Kanto / Orange Islands / Johto)','Indigo adventurer'],
    ['advanced','Advanced Generation','Hoenn explorer'],['diamond-pearl','Diamond & Pearl','Sinnoh dreamer'],
    ['black-white','Black & White','Unova voyager'],['xy','XY / XYZ','Kalos challenger'],['sun-moon','Sun & Moon','Alola daydreamer'],
    ['journeys','Journeys','World traveler'],['horizons','Horizons','Horizon seeker'],['origins','Origins','Origin storyteller'],
    ['generations','Generations','Legend keeper'],['twilight-wings','Twilight Wings','Galar skywatcher'],
    ['other','Another Pokémon animated series','Side-story seeker'],['new','I haven’t watched yet','New chapter trainer']
  ].map(([id,name,title]) => ({id,name,title}));
  const types = {
    normal:['#ece7d9','#675c4b','●'],fire:['#ffe0cf','#a14420','♨'],water:['#dbeaf9','#315e9c','≈'],electric:['#fff1b7','#80620d','ϟ'],
    grass:['#e0edce','#4c703b','✿'],ice:['#d5f3f3','#356d79','❄'],fighting:['#f0d7cc','#873e33','✦'],poison:['#ead5ee','#7a4388','◆'],
    ground:['#efe0c2','#816339','▰'],flying:['#e4e2fb','#63518d','↗'],psychic:['#f8ddec','#964477','✧'],bug:['#e7edc9','#677c2b','✳'],
    rock:['#e8dfc5','#756345','▥'],ghost:['#e4ddef','#624a82','☾'],dragon:['#e2dbfc','#59418d','♜'],dark:['#dedbe2','#4a4257','◐'],
    steel:['#e3e8ee','#53657a','⚙'],fairy:['#f7dfef','#974f82','♡']
  };
  const limits = { name: 40, work: 80, city: 60, message: 200 };
  function normalize(value) { return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : ''; }
  function moderationText(value) {
    const substitutions = {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','і':'i','у':'y'};
    return normalize(value).toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,'').replace(/[013457@$аеорсхіу]/g,char => substitutions[char]);
  }
  const blockedWords = ['fuck','fucking','fucker','motherfucker','shit','shitty','bullshit','bitch','bastard','asshole','cunt','dickhead','slut','whore','retard','retarded','nigger','nigga','faggot','kike'];
  const blockedPatterns = blockedWords.map(word => new RegExp(`(?:^|[^a-z])${word.split('').join('[\\W_]*')}(?:s)?(?:$|[^a-z])`, 'i'));
  const disrespect = /\b(?:kill yourself|go die|you (?:are |re )?(?:stupid|worthless|an idiot)|you suck|kys)\b/i;
  function isDisrespectful(value) {
    const text = moderationText(value);
    return blockedPatterns.some(pattern => pattern.test(text)) || disrespect.test(text.replace(/[^a-z]+/g,' '));
  }
  function validate(input) {
    const errors = {};
    const value = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: { form: 'Please complete the signature form.' }, value };
    for (const [key,max] of Object.entries(limits)) {
      value[key] = normalize(input[key]);
      if (input[key] != null && typeof input[key] !== 'string') errors[key] = 'Please use plain text.';
      else if (key === 'name' && !value[key]) errors[key] = 'Choose a display name or nickname.';
      else if ([...value[key]].length > max) errors[key] = `Please keep this to ${max} characters or fewer.`;
      else if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value[key]) || /https?:\/\/|www\./i.test(value[key])) errors[key] = 'Please use plain text without links or markup.';
      else if (isDisrespectful(value[key])) errors[key] = 'Please keep your signature kind and free of offensive language.';
    }
    value.pokemon = typeof input.pokemon === 'string' ? input.pokemon : '';
    value.game = typeof input.game === 'string' ? input.game : '';
    value.series = typeof input.series === 'string' ? input.series : '';
    if (!globalThis.SignDexPokemon.some(item => item.id === value.pokemon)) errors.pokemon = 'Select a Pokémon from the suggestions.';
    if (!games.some(item => item.id === value.game)) errors.game = 'Choose a game, or select “I haven’t played yet”.';
    if (!series.some(item => item.id === value.series)) errors.series = 'Choose a series, or select “I haven’t watched yet”.';
    if (input.consent !== true) errors.consent = 'Please agree to share these details publicly after review.';
    value.consent = input.consent === true;
    return { value, errors };
  }
  function hash(text) {
    let value = 2166136261;
    for (const character of text) value = Math.imul(value ^ character.codePointAt(0), 16777619);
    return value >>> 0;
  }
  function theme(entry) {
    const pokemon = globalThis.SignDexPokemon.find(item => item.id === entry.pokemon) || globalThis.SignDexPokemon.find(item => item.id === 'pikachu');
    const game = games.find(item => item.id === entry.game) || games[games.length - 1];
    const show = series.find(item => item.id === entry.series) || series[series.length - 1];
    const [paper,ink,symbol] = types[pokemon.type] || types.normal;
    const seed = hash([entry.id || 'preview',entry.name,entry.pokemon,entry.game,entry.series].join('|'));
    return { pokemon, game, show, paper, ink, symbol, seed, pattern: seed % 3, title: show.title };
  }
  globalThis.SignDexModel = { games, series, limits, normalize, validate, isDisrespectful, theme };
})();
