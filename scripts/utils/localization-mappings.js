/**
 * Localization Mappings for Foundry VTT Game Systems
 *
 * This file contains dictionaries for normalizing skills, abilities, and roll types
 * across different RPG systems and languages.
 *
 * Structure:
 * SYSTEM_MAPPINGS[systemId][language] = {
 *   skills: { 'localized name': 'normalized_key' },
 *   abilities: { 'localized name': 'normalized_key' },
 *   rollTypes: { 'localized pattern': 'normalized_type' }
 * }
 *
 * Supported systems: Tier S (Top 10) + Tier A (11-25) + Tier B (26-50)
 */

// ============================================================================
// TIER S - Top 10 Most Popular Systems
// ============================================================================

const DND5E_MAPPINGS = {
  en: {
    skills: {
      'acrobatics': 'acrobatics',
      'animal handling': 'animal_handling',
      'arcana': 'arcana',
      'athletics': 'athletics',
      'deception': 'deception',
      'history': 'history',
      'insight': 'insight',
      'intimidation': 'intimidation',
      'investigation': 'investigation',
      'medicine': 'medicine',
      'nature': 'nature',
      'perception': 'perception',
      'performance': 'performance',
      'persuasion': 'persuasion',
      'religion': 'religion',
      'sleight of hand': 'sleight_of_hand',
      'stealth': 'stealth',
      'survival': 'survival'
    },
    abilities: {
      'strength': 'str',
      'str': 'str',
      'dexterity': 'dex',
      'dex': 'dex',
      'constitution': 'con',
      'con': 'con',
      'intelligence': 'int',
      'int': 'int',
      'wisdom': 'wis',
      'wis': 'wis',
      'charisma': 'cha',
      'cha': 'cha'
    },
    rollTypes: {
      'attack roll': 'attack',
      'attack': 'attack',
      'damage roll': 'damage',
      'damage': 'damage',
      'saving throw': 'save',
      'save': 'save',
      'ability check': 'ability',
      'skill check': 'skill',
      'check': 'skill',
      'death saving throw': 'death_save',
      'death save': 'death_save',
      'initiative': 'initiative',
      'hit dice': 'hit_dice',
      'healing': 'heal'
    }
  },
  fr: {
    skills: {
      'acrobaties': 'acrobatics',
      'acrobatie': 'acrobatics',
      'dressage': 'animal_handling',
      'arcanes': 'arcana',
      'athlétisme': 'athletics',
      'tromperie': 'deception',
      'histoire': 'history',
      'perspicacité': 'insight',
      'intimidation': 'intimidation',
      'investigation': 'investigation',
      'médecine': 'medicine',
      'nature': 'nature',
      'perception': 'perception',
      'représentation': 'performance',
      'persuasion': 'persuasion',
      'religion': 'religion',
      'escamotage': 'sleight_of_hand',
      'discrétion': 'stealth',
      'survie': 'survival'
    },
    abilities: {
      'force': 'str',
      'for': 'str',
      'dextérité': 'dex',
      'dex': 'dex',
      'constitution': 'con',
      'con': 'con',
      'intelligence': 'int',
      'int': 'int',
      'sagesse': 'wis',
      'sag': 'wis',
      'charisme': 'cha',
      'cha': 'cha'
    },
    rollTypes: {
      'jet d\'attaque': 'attack',
      'attaque': 'attack',
      'jet de dégâts': 'damage',
      'dégâts': 'damage',
      'jet de sauvegarde': 'save',
      'sauvegarde': 'save',
      'test de caractéristique': 'ability',
      'test de compétence': 'skill',
      'jet de sauvegarde contre la mort': 'death_save',
      'initiative': 'initiative',
      'dé de vie': 'hit_dice',
      'soins': 'heal'
    }
  }
}

const PF2E_MAPPINGS = {
  en: {
    skills: {
      'acrobatics': 'acrobatics',
      'arcana': 'arcana',
      'athletics': 'athletics',
      'crafting': 'crafting',
      'deception': 'deception',
      'diplomacy': 'diplomacy',
      'intimidation': 'intimidation',
      'lore': 'lore',
      'medicine': 'medicine',
      'nature': 'nature',
      'occultism': 'occultism',
      'performance': 'performance',
      'religion': 'religion',
      'society': 'society',
      'stealth': 'stealth',
      'survival': 'survival',
      'thievery': 'thievery'
    },
    abilities: {
      'strength': 'str',
      'str': 'str',
      'dexterity': 'dex',
      'dex': 'dex',
      'constitution': 'con',
      'con': 'con',
      'intelligence': 'int',
      'int': 'int',
      'wisdom': 'wis',
      'wis': 'wis',
      'charisma': 'cha',
      'cha': 'cha'
    },
    rollTypes: {
      'strike': 'attack',
      'attack roll': 'attack',
      'damage': 'damage',
      'saving throw': 'save',
      'fortitude': 'save_fortitude',
      'reflex': 'save_reflex',
      'will': 'save_will',
      'skill check': 'skill',
      'perception check': 'perception',
      'initiative': 'initiative',
      'flat check': 'flat_check',
      'recovery check': 'recovery'
    }
  },
  fr: {
    skills: {
      'acrobaties': 'acrobatics',
      'arcanes': 'arcana',
      'athlétisme': 'athletics',
      'artisanat': 'crafting',
      'tromperie': 'deception',
      'diplomatie': 'diplomacy',
      'intimidation': 'intimidation',
      'connaissance': 'lore',
      'médecine': 'medicine',
      'nature': 'nature',
      'occultisme': 'occultism',
      'représentation': 'performance',
      'religion': 'religion',
      'société': 'society',
      'discrétion': 'stealth',
      'survie': 'survival',
      'vol': 'thievery'
    },
    abilities: {
      'force': 'str',
      'dextérité': 'dex',
      'constitution': 'con',
      'intelligence': 'int',
      'sagesse': 'wis',
      'charisme': 'cha'
    },
    rollTypes: {
      'frappe': 'attack',
      'jet d\'attaque': 'attack',
      'dégâts': 'damage',
      'jet de sauvegarde': 'save',
      'vigueur': 'save_fortitude',
      'réflexes': 'save_reflex',
      'volonté': 'save_will',
      'test de compétence': 'skill',
      'test de perception': 'perception',
      'initiative': 'initiative',
      'test nu': 'flat_check',
      'test de récupération': 'recovery'
    }
  }
}

const PF1_MAPPINGS = {
  en: {
    skills: {
      'acrobatics': 'acrobatics',
      'appraise': 'appraise',
      'bluff': 'bluff',
      'climb': 'climb',
      'craft': 'craft',
      'diplomacy': 'diplomacy',
      'disable device': 'disable_device',
      'disguise': 'disguise',
      'escape artist': 'escape_artist',
      'fly': 'fly',
      'handle animal': 'handle_animal',
      'heal': 'heal',
      'intimidate': 'intimidate',
      'knowledge': 'knowledge',
      'linguistics': 'linguistics',
      'perception': 'perception',
      'perform': 'perform',
      'profession': 'profession',
      'ride': 'ride',
      'sense motive': 'sense_motive',
      'sleight of hand': 'sleight_of_hand',
      'spellcraft': 'spellcraft',
      'stealth': 'stealth',
      'survival': 'survival',
      'swim': 'swim',
      'use magic device': 'use_magic_device'
    },
    abilities: {
      'strength': 'str',
      'str': 'str',
      'dexterity': 'dex',
      'dex': 'dex',
      'constitution': 'con',
      'con': 'con',
      'intelligence': 'int',
      'int': 'int',
      'wisdom': 'wis',
      'wis': 'wis',
      'charisma': 'cha',
      'cha': 'cha'
    },
    rollTypes: {
      'attack roll': 'attack',
      'attack': 'attack',
      'damage': 'damage',
      'saving throw': 'save',
      'fortitude': 'save_fortitude',
      'reflex': 'save_reflex',
      'will': 'save_will',
      'skill check': 'skill',
      'initiative': 'initiative',
      'cmb': 'cmb',
      'cmd': 'cmd',
      'concentration': 'concentration'
    }
  },
  fr: {
    skills: {
      'acrobaties': 'acrobatics',
      'estimation': 'appraise',
      'bluff': 'bluff',
      'escalade': 'climb',
      'artisanat': 'craft',
      'diplomatie': 'diplomacy',
      'sabotage': 'disable_device',
      'déguisement': 'disguise',
      'évasion': 'escape_artist',
      'vol': 'fly',
      'dressage': 'handle_animal',
      'premiers secours': 'heal',
      'intimidation': 'intimidate',
      'connaissance': 'knowledge',
      'linguistique': 'linguistics',
      'perception': 'perception',
      'représentation': 'perform',
      'profession': 'profession',
      'équitation': 'ride',
      'psychologie': 'sense_motive',
      'escamotage': 'sleight_of_hand',
      'art de la magie': 'spellcraft',
      'discrétion': 'stealth',
      'survie': 'survival',
      'natation': 'swim',
      'utilisation d\'objets magiques': 'use_magic_device'
    },
    abilities: {
      'force': 'str',
      'dextérité': 'dex',
      'constitution': 'con',
      'intelligence': 'int',
      'sagesse': 'wis',
      'charisme': 'cha'
    },
    rollTypes: {
      'jet d\'attaque': 'attack',
      'attaque': 'attack',
      'dégâts': 'damage',
      'jet de sauvegarde': 'save',
      'vigueur': 'save_fortitude',
      'réflexes': 'save_reflex',
      'volonté': 'save_will',
      'test de compétence': 'skill',
      'initiative': 'initiative',
      'bmc': 'cmb',
      'dmd': 'cmd',
      'concentration': 'concentration'
    }
  }
}

const WFRP4E_MAPPINGS = {
  en: {
    skills: {
      // Basic Skills
      'athletics': 'athletics',
      'climb': 'climb',
      'cool': 'cool',
      'dodge': 'dodge',
      'drive': 'drive',
      'endurance': 'endurance',
      'intimidate': 'intimidate',
      'intuition': 'intuition',
      'leadership': 'leadership',
      'melee': 'melee',
      'navigation': 'navigation',
      'outdoor survival': 'outdoor_survival',
      'perception': 'perception',
      'ride': 'ride',
      'row': 'row',
      'stealth': 'stealth',
      // Advanced Skills
      'animal care': 'animal_care',
      'animal training': 'animal_training',
      'channelling': 'channelling',
      'charm': 'charm',
      'charm animal': 'charm_animal',
      'consume alcohol': 'consume_alcohol',
      'entertain': 'entertain',
      'evaluate': 'evaluate',
      'gamble': 'gamble',
      'gossip': 'gossip',
      'haggle': 'haggle',
      'heal': 'heal',
      'language': 'language',
      'lore': 'lore',
      'perform': 'perform',
      'pick lock': 'pick_lock',
      'play': 'play',
      'pray': 'pray',
      'ranged': 'ranged',
      'research': 'research',
      'sail': 'sail',
      'secret signs': 'secret_signs',
      'set trap': 'set_trap',
      'sleight of hand': 'sleight_of_hand',
      'swim': 'swim',
      'track': 'track',
      'trade': 'trade'
    },
    abilities: {
      'weapon skill': 'ws',
      'ws': 'ws',
      'ballistic skill': 'bs',
      'bs': 'bs',
      'strength': 's',
      's': 's',
      'toughness': 't',
      't': 't',
      'initiative': 'i',
      'i': 'i',
      'agility': 'ag',
      'ag': 'ag',
      'dexterity': 'dex',
      'dex': 'dex',
      'intelligence': 'int',
      'int': 'int',
      'willpower': 'wp',
      'wp': 'wp',
      'fellowship': 'fel',
      'fel': 'fel'
    },
    rollTypes: {
      'weapon test': 'attack',
      'melee test': 'attack',
      'ranged test': 'attack',
      'damage': 'damage',
      'skill test': 'skill',
      'characteristic test': 'ability',
      'channelling test': 'channelling',
      'casting test': 'casting',
      'prayer test': 'prayer',
      'opposed test': 'opposed',
      'initiative': 'initiative'
    }
  },
  fr: {
    skills: {
      'athlétisme': 'athletics',
      'escalade': 'climb',
      'calme': 'cool',
      'esquive': 'dodge',
      'conduite': 'drive',
      'endurance': 'endurance',
      'intimidation': 'intimidate',
      'intuition': 'intuition',
      'commandement': 'leadership',
      'corps à corps': 'melee',
      'navigation': 'navigation',
      'survie en extérieur': 'outdoor_survival',
      'perception': 'perception',
      'équitation': 'ride',
      'canotage': 'row',
      'discrétion': 'stealth',
      'soins aux animaux': 'animal_care',
      'dressage': 'animal_training',
      'canalisation': 'channelling',
      'charme': 'charm',
      'charme animal': 'charm_animal',
      'résistance à l\'alcool': 'consume_alcohol',
      'divertissement': 'entertain',
      'estimation': 'evaluate',
      'jeux': 'gamble',
      'commérages': 'gossip',
      'marchandage': 'haggle',
      'soins': 'heal',
      'langue': 'language',
      'connaissance': 'lore',
      'représentation': 'perform',
      'crochetage': 'pick_lock',
      'musique': 'play',
      'prière': 'pray',
      'armes à distance': 'ranged',
      'recherche': 'research',
      'voile': 'sail',
      'signes secrets': 'secret_signs',
      'pose de pièges': 'set_trap',
      'escamotage': 'sleight_of_hand',
      'natation': 'swim',
      'pistage': 'track',
      'métier': 'trade'
    },
    abilities: {
      'capacité de combat': 'ws',
      'cc': 'ws',
      'capacité de tir': 'bs',
      'ct': 'bs',
      'force': 's',
      'f': 's',
      'endurance': 't',
      'e': 't',
      'initiative': 'i',
      'i': 'i',
      'agilité': 'ag',
      'ag': 'ag',
      'dextérité': 'dex',
      'dex': 'dex',
      'intelligence': 'int',
      'int': 'int',
      'force mentale': 'wp',
      'fm': 'wp',
      'sociabilité': 'fel',
      'soc': 'fel'
    },
    rollTypes: {
      'test d\'arme': 'attack',
      'test de corps à corps': 'attack',
      'test de tir': 'attack',
      'dégâts': 'damage',
      'test de compétence': 'skill',
      'test de caractéristique': 'ability',
      'test de canalisation': 'channelling',
      'test d\'incantation': 'casting',
      'test de prière': 'prayer',
      'test opposé': 'opposed',
      'initiative': 'initiative'
    }
  }
}

const LANCER_MAPPINGS = {
  en: {
    skills: {
      'apply fists to faces': 'apply_fists',
      'assault': 'assault',
      'blow something up': 'blow_up',
      'charm': 'charm',
      'get a hold of something': 'get_hold',
      'get somewhere quickly': 'get_quickly',
      'hack or fix': 'hack_fix',
      'invent or create': 'invent',
      'investigate': 'investigate',
      'lead or inspire': 'lead',
      'patch': 'patch',
      'pull rank': 'pull_rank',
      'read a situation': 'read_situation',
      'show off': 'show_off',
      'spot': 'spot',
      'stay cool': 'stay_cool',
      'survive': 'survive',
      'take control': 'take_control',
      'take someone out': 'take_out',
      'threaten': 'threaten',
      'word on the street': 'word_street'
    },
    abilities: {
      'hull': 'hull',
      'agility': 'agi',
      'agi': 'agi',
      'systems': 'sys',
      'sys': 'sys',
      'engineering': 'eng',
      'eng': 'eng'
    },
    rollTypes: {
      'attack': 'attack',
      'tech attack': 'tech_attack',
      'damage': 'damage',
      'save': 'save',
      'hull save': 'save_hull',
      'agility save': 'save_agi',
      'systems save': 'save_sys',
      'engineering save': 'save_eng',
      'skill check': 'skill',
      'structure': 'structure',
      'overheating': 'overheat'
    }
  },
  fr: {
    skills: {
      'frapper': 'apply_fists',
      'assaut': 'assault',
      'faire exploser': 'blow_up',
      'charmer': 'charm',
      'obtenir quelque chose': 'get_hold',
      'se déplacer vite': 'get_quickly',
      'pirater ou réparer': 'hack_fix',
      'inventer': 'invent',
      'enquêter': 'investigate',
      'diriger': 'lead',
      'réparer': 'patch',
      'faire valoir son rang': 'pull_rank',
      'analyser la situation': 'read_situation',
      'frimer': 'show_off',
      'repérer': 'spot',
      'garder son calme': 'stay_cool',
      'survivre': 'survive',
      'prendre le contrôle': 'take_control',
      'éliminer': 'take_out',
      'menacer': 'threaten',
      'rumeurs': 'word_street'
    },
    abilities: {
      'coque': 'hull',
      'agilité': 'agi',
      'systèmes': 'sys',
      'ingénierie': 'eng'
    },
    rollTypes: {
      'attaque': 'attack',
      'attaque tech': 'tech_attack',
      'dégâts': 'damage',
      'sauvegarde': 'save',
      'test de compétence': 'skill',
      'structure': 'structure',
      'surchauffe': 'overheat'
    }
  }
}

const CYBERPUNK_RED_MAPPINGS = {
  en: {
    skills: {
      'athletics': 'athletics',
      'brawling': 'brawling',
      'concentration': 'concentration',
      'conversation': 'conversation',
      'education': 'education',
      'evasion': 'evasion',
      'first aid': 'first_aid',
      'human perception': 'human_perception',
      'language': 'language',
      'local expert': 'local_expert',
      'perception': 'perception',
      'persuasion': 'persuasion',
      'stealth': 'stealth',
      'tracking': 'tracking',
      'accounting': 'accounting',
      'acting': 'acting',
      'animal handling': 'animal_handling',
      'archery': 'archery',
      'autofire': 'autofire',
      'basic tech': 'basic_tech',
      'bureaucracy': 'bureaucracy',
      'business': 'business',
      'composition': 'composition',
      'conceal/reveal object': 'conceal_reveal',
      'contortionist': 'contortionist',
      'criminology': 'criminology',
      'cryptography': 'cryptography',
      'cybertech': 'cybertech',
      'dance': 'dance',
      'deduction': 'deduction',
      'demolitions': 'demolitions',
      'drive land vehicle': 'drive_land',
      'electronics/security tech': 'electronics_security',
      'endurance': 'endurance',
      'forgery': 'forgery',
      'gambling': 'gambling',
      'handgun': 'handgun',
      'heavy weapons': 'heavy_weapons',
      'interrogation': 'interrogation',
      'land vehicle tech': 'land_vehicle_tech',
      'library search': 'library_search',
      'lip reading': 'lip_reading',
      'martial arts': 'martial_arts',
      'melee weapon': 'melee_weapon',
      'paint/draw/sculpt': 'art',
      'paramedic': 'paramedic',
      'photography/film': 'photography',
      'pick lock': 'pick_lock',
      'pick pocket': 'pick_pocket',
      'pilot air vehicle': 'pilot_air',
      'pilot sea vehicle': 'pilot_sea',
      'play instrument': 'play_instrument',
      'resist torture/drugs': 'resist_torture',
      'riding': 'riding',
      'science': 'science',
      'sea vehicle tech': 'sea_vehicle_tech',
      'shoulder arms': 'shoulder_arms',
      'streetwise': 'streetwise',
      'tactics': 'tactics',
      'trading': 'trading',
      'wardrobe & style': 'wardrobe_style',
      'weaponstech': 'weaponstech',
      'wilderness survival': 'wilderness_survival'
    },
    abilities: {
      'intelligence': 'int',
      'int': 'int',
      'reflexes': 'ref',
      'ref': 'ref',
      'dexterity': 'dex',
      'dex': 'dex',
      'technology': 'tech',
      'tech': 'tech',
      'cool': 'cool',
      'willpower': 'will',
      'will': 'will',
      'luck': 'luck',
      'move': 'move',
      'body': 'body',
      'empathy': 'emp',
      'emp': 'emp'
    },
    rollTypes: {
      'attack': 'attack',
      'damage': 'damage',
      'skill check': 'skill',
      'stat check': 'ability',
      'death save': 'death_save',
      'initiative': 'initiative',
      'humanity': 'humanity',
      'facedown': 'facedown'
    }
  },
  fr: {
    skills: {
      'athlétisme': 'athletics',
      'bagarre': 'brawling',
      'concentration': 'concentration',
      'conversation': 'conversation',
      'éducation': 'education',
      'évasion': 'evasion',
      'premiers soins': 'first_aid',
      'perception humaine': 'human_perception',
      'langue': 'language',
      'expert local': 'local_expert',
      'perception': 'perception',
      'persuasion': 'persuasion',
      'discrétion': 'stealth',
      'pistage': 'tracking'
    },
    abilities: {
      'intelligence': 'int',
      'réflexes': 'ref',
      'dextérité': 'dex',
      'technologie': 'tech',
      'sang-froid': 'cool',
      'volonté': 'will',
      'chance': 'luck',
      'mouvement': 'move',
      'corps': 'body',
      'empathie': 'emp'
    },
    rollTypes: {
      'attaque': 'attack',
      'dégâts': 'damage',
      'test de compétence': 'skill',
      'test de caractéristique': 'ability',
      'jet de mort': 'death_save',
      'initiative': 'initiative'
    }
  }
}

const COC7_MAPPINGS = {
  en: {
    skills: {
      'accounting': 'accounting',
      'anthropology': 'anthropology',
      'appraise': 'appraise',
      'archaeology': 'archaeology',
      'art/craft': 'art_craft',
      'charm': 'charm',
      'climb': 'climb',
      'credit rating': 'credit_rating',
      'cthulhu mythos': 'cthulhu_mythos',
      'disguise': 'disguise',
      'dodge': 'dodge',
      'drive auto': 'drive_auto',
      'electrical repair': 'electrical_repair',
      'fast talk': 'fast_talk',
      'fighting': 'fighting',
      'firearms': 'firearms',
      'first aid': 'first_aid',
      'history': 'history',
      'intimidate': 'intimidate',
      'jump': 'jump',
      'language': 'language',
      'law': 'law',
      'library use': 'library_use',
      'listen': 'listen',
      'locksmith': 'locksmith',
      'mechanical repair': 'mechanical_repair',
      'medicine': 'medicine',
      'natural world': 'natural_world',
      'navigate': 'navigate',
      'occult': 'occult',
      'operate heavy machinery': 'operate_heavy',
      'persuade': 'persuade',
      'pilot': 'pilot',
      'psychoanalysis': 'psychoanalysis',
      'psychology': 'psychology',
      'ride': 'ride',
      'science': 'science',
      'sleight of hand': 'sleight_of_hand',
      'spot hidden': 'spot_hidden',
      'stealth': 'stealth',
      'survival': 'survival',
      'swim': 'swim',
      'throw': 'throw',
      'track': 'track'
    },
    abilities: {
      'strength': 'str',
      'str': 'str',
      'constitution': 'con',
      'con': 'con',
      'size': 'siz',
      'siz': 'siz',
      'dexterity': 'dex',
      'dex': 'dex',
      'appearance': 'app',
      'app': 'app',
      'intelligence': 'int',
      'int': 'int',
      'power': 'pow',
      'pow': 'pow',
      'education': 'edu',
      'edu': 'edu',
      'luck': 'luck'
    },
    rollTypes: {
      'skill roll': 'skill',
      'skill': 'skill',
      'characteristic roll': 'ability',
      'attack': 'attack',
      'damage': 'damage',
      'sanity': 'sanity',
      'san': 'sanity',
      'luck': 'luck',
      'idea': 'idea',
      'know': 'know',
      'opposed': 'opposed'
    }
  },
  fr: {
    skills: {
      'comptabilité': 'accounting',
      'anthropologie': 'anthropology',
      'estimation': 'appraise',
      'archéologie': 'archaeology',
      'art/artisanat': 'art_craft',
      'charme': 'charm',
      'escalade': 'climb',
      'crédit': 'credit_rating',
      'mythe de cthulhu': 'cthulhu_mythos',
      'déguisement': 'disguise',
      'esquive': 'dodge',
      'conduire auto': 'drive_auto',
      'électricité': 'electrical_repair',
      'baratin': 'fast_talk',
      'combat': 'fighting',
      'armes à feu': 'firearms',
      'premiers soins': 'first_aid',
      'histoire': 'history',
      'intimidation': 'intimidate',
      'saut': 'jump',
      'langue': 'language',
      'droit': 'law',
      'bibliothèque': 'library_use',
      'écouter': 'listen',
      'serrurerie': 'locksmith',
      'mécanique': 'mechanical_repair',
      'médecine': 'medicine',
      'monde naturel': 'natural_world',
      'orientation': 'navigate',
      'occultisme': 'occult',
      'machinerie lourde': 'operate_heavy',
      'persuasion': 'persuade',
      'pilotage': 'pilot',
      'psychanalyse': 'psychoanalysis',
      'psychologie': 'psychology',
      'équitation': 'ride',
      'science': 'science',
      'escamotage': 'sleight_of_hand',
      'trouver objet caché': 'spot_hidden',
      'discrétion': 'stealth',
      'survie': 'survival',
      'nager': 'swim',
      'lancer': 'throw',
      'pister': 'track'
    },
    abilities: {
      'force': 'str',
      'constitution': 'con',
      'taille': 'siz',
      'dextérité': 'dex',
      'apparence': 'app',
      'intelligence': 'int',
      'pouvoir': 'pow',
      'éducation': 'edu',
      'chance': 'luck'
    },
    rollTypes: {
      'jet de compétence': 'skill',
      'compétence': 'skill',
      'jet de caractéristique': 'ability',
      'attaque': 'attack',
      'dégâts': 'damage',
      'santé mentale': 'sanity',
      'chance': 'luck',
      'idée': 'idea',
      'connaissance': 'know',
      'opposé': 'opposed'
    }
  }
}

const SWADE_MAPPINGS = {
  en: {
    skills: {
      'academics': 'academics',
      'athletics': 'athletics',
      'battle': 'battle',
      'boating': 'boating',
      'common knowledge': 'common_knowledge',
      'driving': 'driving',
      'electronics': 'electronics',
      'faith': 'faith',
      'fighting': 'fighting',
      'focus': 'focus',
      'gambling': 'gambling',
      'hacking': 'hacking',
      'healing': 'healing',
      'intimidation': 'intimidation',
      'language': 'language',
      'notice': 'notice',
      'occult': 'occult',
      'performance': 'performance',
      'persuasion': 'persuasion',
      'piloting': 'piloting',
      'psionics': 'psionics',
      'repair': 'repair',
      'research': 'research',
      'riding': 'riding',
      'science': 'science',
      'shooting': 'shooting',
      'spellcasting': 'spellcasting',
      'stealth': 'stealth',
      'survival': 'survival',
      'taunt': 'taunt',
      'thievery': 'thievery',
      'weird science': 'weird_science'
    },
    abilities: {
      'agility': 'agi',
      'smarts': 'sma',
      'spirit': 'spi',
      'strength': 'str',
      'vigor': 'vig'
    },
    rollTypes: {
      'trait roll': 'trait',
      'skill roll': 'skill',
      'attack': 'attack',
      'damage': 'damage',
      'soak': 'soak',
      'spirit': 'spirit',
      'vigor': 'vigor',
      'running': 'running',
      'wild die': 'wild_die'
    }
  },
  fr: {
    skills: {
      'académique': 'academics',
      'athlétisme': 'athletics',
      'combat de masse': 'battle',
      'navigation': 'boating',
      'culture générale': 'common_knowledge',
      'conduite': 'driving',
      'électronique': 'electronics',
      'foi': 'faith',
      'combat': 'fighting',
      'concentration': 'focus',
      'jeu': 'gambling',
      'piratage': 'hacking',
      'soins': 'healing',
      'intimidation': 'intimidation',
      'langue': 'language',
      'perception': 'notice',
      'occultisme': 'occult',
      'représentation': 'performance',
      'persuasion': 'persuasion',
      'pilotage': 'piloting',
      'psionique': 'psionics',
      'réparation': 'repair',
      'recherche': 'research',
      'équitation': 'riding',
      'science': 'science',
      'tir': 'shooting',
      'magie': 'spellcasting',
      'discrétion': 'stealth',
      'survie': 'survival',
      'provocation': 'taunt',
      'larcin': 'thievery',
      'science étrange': 'weird_science'
    },
    abilities: {
      'agilité': 'agi',
      'intellect': 'sma',
      'âme': 'spi',
      'force': 'str',
      'vigueur': 'vig'
    },
    rollTypes: {
      'jet de trait': 'trait',
      'jet de compétence': 'skill',
      'attaque': 'attack',
      'dégâts': 'damage',
      'encaissement': 'soak',
      'dé joker': 'wild_die'
    }
  }
}

// ============================================================================
// TIER A - Popular Systems (11-25)
// ============================================================================

const STARFINDER_MAPPINGS = {
  en: {
    skills: {
      'acrobatics': 'acrobatics',
      'athletics': 'athletics',
      'bluff': 'bluff',
      'computers': 'computers',
      'culture': 'culture',
      'diplomacy': 'diplomacy',
      'disguise': 'disguise',
      'engineering': 'engineering',
      'intimidate': 'intimidate',
      'life science': 'life_science',
      'medicine': 'medicine',
      'mysticism': 'mysticism',
      'perception': 'perception',
      'physical science': 'physical_science',
      'piloting': 'piloting',
      'profession': 'profession',
      'sense motive': 'sense_motive',
      'sleight of hand': 'sleight_of_hand',
      'stealth': 'stealth',
      'survival': 'survival'
    },
    abilities: {
      'strength': 'str',
      'dexterity': 'dex',
      'constitution': 'con',
      'intelligence': 'int',
      'wisdom': 'wis',
      'charisma': 'cha'
    },
    rollTypes: {
      'attack': 'attack',
      'damage': 'damage',
      'saving throw': 'save',
      'fortitude': 'save_fort',
      'reflex': 'save_ref',
      'will': 'save_will',
      'skill check': 'skill',
      'initiative': 'initiative'
    }
  },
  fr: {
    skills: {
      'acrobaties': 'acrobatics',
      'athlétisme': 'athletics',
      'bluff': 'bluff',
      'informatique': 'computers',
      'culture': 'culture',
      'diplomatie': 'diplomacy',
      'déguisement': 'disguise',
      'ingénierie': 'engineering',
      'intimidation': 'intimidate',
      'sciences de la vie': 'life_science',
      'médecine': 'medicine',
      'mysticisme': 'mysticism',
      'perception': 'perception',
      'sciences physiques': 'physical_science',
      'pilotage': 'piloting',
      'profession': 'profession',
      'psychologie': 'sense_motive',
      'escamotage': 'sleight_of_hand',
      'discrétion': 'stealth',
      'survie': 'survival'
    },
    abilities: {
      'force': 'str',
      'dextérité': 'dex',
      'constitution': 'con',
      'intelligence': 'int',
      'sagesse': 'wis',
      'charisme': 'cha'
    },
    rollTypes: {
      'attaque': 'attack',
      'dégâts': 'damage',
      'jet de sauvegarde': 'save',
      'vigueur': 'save_fort',
      'réflexes': 'save_ref',
      'volonté': 'save_will',
      'test de compétence': 'skill',
      'initiative': 'initiative'
    }
  }
}

const STAR_WARS_FFG_MAPPINGS = {
  en: {
    skills: {
      // General Skills
      'astrogation': 'astrogation',
      'athletics': 'athletics',
      'charm': 'charm',
      'coercion': 'coercion',
      'computers': 'computers',
      'cool': 'cool',
      'coordination': 'coordination',
      'deception': 'deception',
      'discipline': 'discipline',
      'leadership': 'leadership',
      'mechanics': 'mechanics',
      'medicine': 'medicine',
      'negotiation': 'negotiation',
      'perception': 'perception',
      'piloting - planetary': 'piloting_planetary',
      'piloting - space': 'piloting_space',
      'resilience': 'resilience',
      'skulduggery': 'skulduggery',
      'stealth': 'stealth',
      'streetwise': 'streetwise',
      'survival': 'survival',
      'vigilance': 'vigilance',
      // Combat Skills
      'brawl': 'brawl',
      'gunnery': 'gunnery',
      'melee': 'melee',
      'ranged - light': 'ranged_light',
      'ranged - heavy': 'ranged_heavy',
      'lightsaber': 'lightsaber',
      // Knowledge Skills
      'core worlds': 'core_worlds',
      'education': 'education',
      'lore': 'lore',
      'outer rim': 'outer_rim',
      'underworld': 'underworld',
      'warfare': 'warfare',
      'xenology': 'xenology'
    },
    abilities: {
      'brawn': 'br',
      'agility': 'ag',
      'intellect': 'int',
      'cunning': 'cun',
      'willpower': 'will',
      'presence': 'pr'
    },
    rollTypes: {
      'skill check': 'skill',
      'attack': 'attack',
      'force power': 'force',
      'initiative': 'initiative',
      'fear check': 'fear',
      'opposed': 'opposed'
    }
  },
  fr: {
    skills: {
      'astrogation': 'astrogation',
      'athlétisme': 'athletics',
      'charme': 'charm',
      'coercition': 'coercion',
      'informatique': 'computers',
      'sang-froid': 'cool',
      'coordination': 'coordination',
      'tromperie': 'deception',
      'discipline': 'discipline',
      'commandement': 'leadership',
      'mécanique': 'mechanics',
      'médecine': 'medicine',
      'négociation': 'negotiation',
      'perception': 'perception',
      'pilotage - planétaire': 'piloting_planetary',
      'pilotage - spatial': 'piloting_space',
      'résistance': 'resilience',
      'magouilles': 'skulduggery',
      'discrétion': 'stealth',
      'connaissance de la rue': 'streetwise',
      'survie': 'survival',
      'vigilance': 'vigilance',
      'bagarre': 'brawl',
      'artillerie': 'gunnery',
      'mêlée': 'melee',
      'armes légères': 'ranged_light',
      'armes lourdes': 'ranged_heavy',
      'sabre laser': 'lightsaber'
    },
    abilities: {
      'vigueur': 'br',
      'agilité': 'ag',
      'intellect': 'int',
      'ruse': 'cun',
      'volonté': 'will',
      'présence': 'pr'
    },
    rollTypes: {
      'test de compétence': 'skill',
      'attaque': 'attack',
      'pouvoir de la force': 'force',
      'initiative': 'initiative',
      'test de peur': 'fear',
      'opposé': 'opposed'
    }
  }
}

const WOD5E_MAPPINGS = {
  en: {
    skills: {
      // Physical
      'athletics': 'athletics',
      'brawl': 'brawl',
      'craft': 'craft',
      'drive': 'drive',
      'firearms': 'firearms',
      'melee': 'melee',
      'larceny': 'larceny',
      'stealth': 'stealth',
      'survival': 'survival',
      // Social
      'animal ken': 'animal_ken',
      'etiquette': 'etiquette',
      'insight': 'insight',
      'intimidation': 'intimidation',
      'leadership': 'leadership',
      'performance': 'performance',
      'persuasion': 'persuasion',
      'streetwise': 'streetwise',
      'subterfuge': 'subterfuge',
      // Mental
      'academics': 'academics',
      'awareness': 'awareness',
      'finance': 'finance',
      'investigation': 'investigation',
      'medicine': 'medicine',
      'occult': 'occult',
      'politics': 'politics',
      'science': 'science',
      'technology': 'technology'
    },
    abilities: {
      'strength': 'str',
      'dexterity': 'dex',
      'stamina': 'sta',
      'charisma': 'cha',
      'manipulation': 'man',
      'composure': 'com',
      'intelligence': 'int',
      'wits': 'wit',
      'resolve': 'res'
    },
    rollTypes: {
      'skill roll': 'skill',
      'rouse check': 'rouse',
      'frenzy': 'frenzy',
      'remorse': 'remorse',
      'willpower': 'willpower',
      'humanity': 'humanity',
      'discipline': 'discipline',
      'hunting': 'hunting'
    }
  },
  fr: {
    skills: {
      'athlétisme': 'athletics',
      'bagarre': 'brawl',
      'artisanat': 'craft',
      'conduite': 'drive',
      'armes à feu': 'firearms',
      'mêlée': 'melee',
      'larcin': 'larceny',
      'discrétion': 'stealth',
      'survie': 'survival',
      'empathie animale': 'animal_ken',
      'étiquette': 'etiquette',
      'perspicacité': 'insight',
      'intimidation': 'intimidation',
      'commandement': 'leadership',
      'représentation': 'performance',
      'persuasion': 'persuasion',
      'connaissance de la rue': 'streetwise',
      'subterfuge': 'subterfuge',
      'érudition': 'academics',
      'vigilance': 'awareness',
      'finance': 'finance',
      'investigation': 'investigation',
      'médecine': 'medicine',
      'occultisme': 'occult',
      'politique': 'politics',
      'science': 'science',
      'technologie': 'technology'
    },
    abilities: {
      'force': 'str',
      'dextérité': 'dex',
      'vigueur': 'sta',
      'charisme': 'cha',
      'manipulation': 'man',
      'sang-froid': 'com',
      'intelligence': 'int',
      'astuce': 'wit',
      'résolution': 'res'
    },
    rollTypes: {
      'jet de compétence': 'skill',
      'test de soif': 'rouse',
      'frénésie': 'frenzy',
      'remords': 'remorse',
      'volonté': 'willpower',
      'humanité': 'humanity',
      'discipline': 'discipline',
      'chasse': 'hunting'
    }
  }
}

const ALIEN_RPG_MAPPINGS = {
  en: {
    skills: {
      'heavy machinery': 'heavy_machinery',
      'stamina': 'stamina',
      'close combat': 'close_combat',
      'mobility': 'mobility',
      'piloting': 'piloting',
      'ranged combat': 'ranged_combat',
      'observation': 'observation',
      'comtech': 'comtech',
      'survival': 'survival',
      'command': 'command',
      'manipulation': 'manipulation',
      'medical aid': 'medical_aid'
    },
    abilities: {
      'strength': 'str',
      'agility': 'agi',
      'wits': 'wit',
      'empathy': 'emp'
    },
    rollTypes: {
      'skill roll': 'skill',
      'attack': 'attack',
      'panic': 'panic',
      'stress': 'stress'
    }
  },
  fr: {
    skills: {
      'machinerie lourde': 'heavy_machinery',
      'endurance': 'stamina',
      'combat rapproché': 'close_combat',
      'mobilité': 'mobility',
      'pilotage': 'piloting',
      'combat à distance': 'ranged_combat',
      'observation': 'observation',
      'technologie': 'comtech',
      'survie': 'survival',
      'commandement': 'command',
      'manipulation': 'manipulation',
      'soins': 'medical_aid'
    },
    abilities: {
      'force': 'str',
      'agilité': 'agi',
      'esprit': 'wit',
      'empathie': 'emp'
    },
    rollTypes: {
      'jet de compétence': 'skill',
      'attaque': 'attack',
      'panique': 'panic',
      'stress': 'stress'
    }
  }
}

const WRATH_AND_GLORY_MAPPINGS = {
  en: {
    skills: {
      'athletics': 'athletics',
      'awareness': 'awareness',
      'ballistic skill': 'ballistic_skill',
      'cunning': 'cunning',
      'deception': 'deception',
      'insight': 'insight',
      'intimidation': 'intimidation',
      'investigation': 'investigation',
      'leadership': 'leadership',
      'medicae': 'medicae',
      'persuasion': 'persuasion',
      'pilot': 'pilot',
      'psychic mastery': 'psychic_mastery',
      'scholar': 'scholar',
      'stealth': 'stealth',
      'survival': 'survival',
      'tech': 'tech',
      'weapon skill': 'weapon_skill'
    },
    abilities: {
      'strength': 'str',
      'agility': 'agi',
      'toughness': 'tou',
      'intellect': 'int',
      'willpower': 'wil',
      'fellowship': 'fel',
      'initiative': 'ini'
    },
    rollTypes: {
      'skill test': 'skill',
      'attack': 'attack',
      'damage': 'damage',
      'determination': 'determination',
      'corruption': 'corruption',
      'fear': 'fear',
      'psychic power': 'psychic',
      'wrath': 'wrath'
    }
  },
  fr: {
    skills: {
      'athlétisme': 'athletics',
      'vigilance': 'awareness',
      'capacité de tir': 'ballistic_skill',
      'ruse': 'cunning',
      'tromperie': 'deception',
      'perspicacité': 'insight',
      'intimidation': 'intimidation',
      'investigation': 'investigation',
      'commandement': 'leadership',
      'médecine': 'medicae',
      'persuasion': 'persuasion',
      'pilotage': 'pilot',
      'maîtrise psychique': 'psychic_mastery',
      'érudition': 'scholar',
      'discrétion': 'stealth',
      'survie': 'survival',
      'technologie': 'tech',
      'capacité de combat': 'weapon_skill'
    },
    abilities: {
      'force': 'str',
      'agilité': 'agi',
      'endurance': 'tou',
      'intellect': 'int',
      'volonté': 'wil',
      'sociabilité': 'fel',
      'initiative': 'ini'
    },
    rollTypes: {
      'test de compétence': 'skill',
      'attaque': 'attack',
      'dégâts': 'damage',
      'détermination': 'determination',
      'corruption': 'corruption',
      'peur': 'fear',
      'pouvoir psychique': 'psychic',
      'courroux': 'wrath'
    }
  }
}

const DELTA_GREEN_MAPPINGS = {
  en: {
    skills: {
      'accounting': 'accounting',
      'alertness': 'alertness',
      'anthropology': 'anthropology',
      'archeology': 'archeology',
      'art': 'art',
      'artillery': 'artillery',
      'athletics': 'athletics',
      'bureaucracy': 'bureaucracy',
      'computer science': 'computer_science',
      'craft': 'craft',
      'criminology': 'criminology',
      'demolitions': 'demolitions',
      'disguise': 'disguise',
      'dodge': 'dodge',
      'drive': 'drive',
      'firearms': 'firearms',
      'first aid': 'first_aid',
      'forensics': 'forensics',
      'heavy machinery': 'heavy_machinery',
      'heavy weapons': 'heavy_weapons',
      'history': 'history',
      'humint': 'humint',
      'law': 'law',
      'medicine': 'medicine',
      'melee weapons': 'melee_weapons',
      'military science': 'military_science',
      'navigate': 'navigate',
      'occult': 'occult',
      'persuade': 'persuade',
      'pharmacy': 'pharmacy',
      'pilot': 'pilot',
      'psychotherapy': 'psychotherapy',
      'ride': 'ride',
      'science': 'science',
      'search': 'search',
      'sigint': 'sigint',
      'stealth': 'stealth',
      'surgery': 'surgery',
      'survival': 'survival',
      'swim': 'swim',
      'unarmed combat': 'unarmed_combat',
      'unnatural': 'unnatural'
    },
    abilities: {
      'strength': 'str',
      'constitution': 'con',
      'dexterity': 'dex',
      'intelligence': 'int',
      'power': 'pow',
      'charisma': 'cha'
    },
    rollTypes: {
      'skill test': 'skill',
      'stat test': 'ability',
      'attack': 'attack',
      'damage': 'damage',
      'sanity': 'sanity',
      'luck': 'luck',
      'lethality': 'lethality'
    }
  },
  fr: {
    skills: {
      'comptabilité': 'accounting',
      'vigilance': 'alertness',
      'anthropologie': 'anthropology',
      'archéologie': 'archeology',
      'art': 'art',
      'artillerie': 'artillery',
      'athlétisme': 'athletics',
      'bureaucratie': 'bureaucracy',
      'informatique': 'computer_science',
      'artisanat': 'craft',
      'criminologie': 'criminology',
      'explosifs': 'demolitions',
      'déguisement': 'disguise',
      'esquive': 'dodge',
      'conduite': 'drive',
      'armes à feu': 'firearms',
      'premiers soins': 'first_aid',
      'médecine légale': 'forensics',
      'machinerie lourde': 'heavy_machinery',
      'armes lourdes': 'heavy_weapons',
      'histoire': 'history',
      'renseignement humain': 'humint',
      'droit': 'law',
      'médecine': 'medicine',
      'armes de mêlée': 'melee_weapons',
      'science militaire': 'military_science',
      'navigation': 'navigate',
      'occultisme': 'occult',
      'persuasion': 'persuade',
      'pharmacie': 'pharmacy',
      'pilotage': 'pilot',
      'psychothérapie': 'psychotherapy',
      'équitation': 'ride',
      'science': 'science',
      'recherche': 'search',
      'renseignement électronique': 'sigint',
      'discrétion': 'stealth',
      'chirurgie': 'surgery',
      'survie': 'survival',
      'nage': 'swim',
      'combat à mains nues': 'unarmed_combat',
      'surnaturel': 'unnatural'
    },
    abilities: {
      'force': 'str',
      'constitution': 'con',
      'dextérité': 'dex',
      'intelligence': 'int',
      'pouvoir': 'pow',
      'charisme': 'cha'
    },
    rollTypes: {
      'test de compétence': 'skill',
      'test de caractéristique': 'ability',
      'attaque': 'attack',
      'dégâts': 'damage',
      'santé mentale': 'sanity',
      'chance': 'luck',
      'létalité': 'lethality'
    }
  }
}

const FORBIDDEN_LANDS_MAPPINGS = {
  en: {
    skills: {
      'might': 'might',
      'endurance': 'endurance',
      'melee': 'melee',
      'crafting': 'crafting',
      'stealth': 'stealth',
      'sleight of hand': 'sleight_of_hand',
      'move': 'move',
      'marksmanship': 'marksmanship',
      'scouting': 'scouting',
      'lore': 'lore',
      'survival': 'survival',
      'insight': 'insight',
      'manipulation': 'manipulation',
      'performance': 'performance',
      'healing': 'healing',
      'animal handling': 'animal_handling'
    },
    abilities: {
      'strength': 'str',
      'agility': 'agi',
      'wits': 'wit',
      'empathy': 'emp'
    },
    rollTypes: {
      'skill roll': 'skill',
      'attack': 'attack',
      'damage': 'damage',
      'pushing': 'pushing'
    }
  },
  fr: {
    skills: {
      'puissance': 'might',
      'endurance': 'endurance',
      'mêlée': 'melee',
      'artisanat': 'crafting',
      'discrétion': 'stealth',
      'escamotage': 'sleight_of_hand',
      'déplacement': 'move',
      'tir': 'marksmanship',
      'repérage': 'scouting',
      'connaissance': 'lore',
      'survie': 'survival',
      'perspicacité': 'insight',
      'manipulation': 'manipulation',
      'représentation': 'performance',
      'soins': 'healing',
      'dressage': 'animal_handling'
    },
    abilities: {
      'force': 'str',
      'agilité': 'agi',
      'esprit': 'wit',
      'empathie': 'emp'
    },
    rollTypes: {
      'jet de compétence': 'skill',
      'attaque': 'attack',
      'dégâts': 'damage',
      'forçage': 'pushing'
    }
  }
}

// ============================================================================
// TIER B - Established Systems (26-50)
// ============================================================================

const BLADES_IN_THE_DARK_MAPPINGS = {
  en: {
    skills: {
      // Insight
      'hunt': 'hunt',
      'study': 'study',
      'survey': 'survey',
      'tinker': 'tinker',
      // Prowess
      'finesse': 'finesse',
      'prowl': 'prowl',
      'skirmish': 'skirmish',
      'wreck': 'wreck',
      // Resolve
      'attune': 'attune',
      'command': 'command',
      'consort': 'consort',
      'sway': 'sway'
    },
    abilities: {
      'insight': 'insight',
      'prowess': 'prowess',
      'resolve': 'resolve'
    },
    rollTypes: {
      'action roll': 'action',
      'resistance roll': 'resistance',
      'fortune roll': 'fortune',
      'engagement roll': 'engagement',
      'downtime': 'downtime'
    }
  },
  fr: {
    skills: {
      'chasser': 'hunt',
      'étudier': 'study',
      'observer': 'survey',
      'bricoler': 'tinker',
      'finesse': 'finesse',
      'rôder': 'prowl',
      'escarmouche': 'skirmish',
      'détruire': 'wreck',
      'harmoniser': 'attune',
      'commander': 'command',
      'fréquenter': 'consort',
      'influencer': 'sway'
    },
    abilities: {
      'perspicacité': 'insight',
      'prouesse': 'prowess',
      'résolution': 'resolve'
    },
    rollTypes: {
      'jet d\'action': 'action',
      'jet de résistance': 'resistance',
      'jet de fortune': 'fortune',
      'jet d\'engagement': 'engagement',
      'temps mort': 'downtime'
    }
  }
}

const MORK_BORG_MAPPINGS = {
  en: {
    skills: {
      'agility': 'agility',
      'presence': 'presence',
      'strength': 'strength',
      'toughness': 'toughness'
    },
    abilities: {
      'agility': 'agi',
      'presence': 'pre',
      'strength': 'str',
      'toughness': 'tou'
    },
    rollTypes: {
      'ability test': 'ability',
      'attack': 'attack',
      'damage': 'damage',
      'defense': 'defense',
      'morale': 'morale',
      'reaction': 'reaction',
      'death': 'death'
    }
  },
  fr: {
    skills: {
      'agilité': 'agility',
      'présence': 'presence',
      'force': 'strength',
      'résistance': 'toughness'
    },
    abilities: {
      'agilité': 'agi',
      'présence': 'pre',
      'force': 'str',
      'résistance': 'tou'
    },
    rollTypes: {
      'test de caractéristique': 'ability',
      'attaque': 'attack',
      'dégâts': 'damage',
      'défense': 'defense',
      'moral': 'morale',
      'réaction': 'reaction',
      'mort': 'death'
    }
  }
}

const VAESEN_MAPPINGS = {
  en: {
    skills: {
      'agility': 'agility',
      'close combat': 'close_combat',
      'force': 'force',
      'medicine': 'medicine',
      'ranged combat': 'ranged_combat',
      'stealth': 'stealth',
      'investigation': 'investigation',
      'learning': 'learning',
      'vigilance': 'vigilance',
      'inspiration': 'inspiration',
      'manipulation': 'manipulation',
      'observation': 'observation'
    },
    abilities: {
      'physique': 'phy',
      'precision': 'pre',
      'logic': 'log',
      'empathy': 'emp'
    },
    rollTypes: {
      'skill roll': 'skill',
      'attack': 'attack',
      'damage': 'damage',
      'fear': 'fear'
    }
  },
  fr: {
    skills: {
      'agilité': 'agility',
      'combat rapproché': 'close_combat',
      'force': 'force',
      'médecine': 'medicine',
      'combat à distance': 'ranged_combat',
      'discrétion': 'stealth',
      'investigation': 'investigation',
      'érudition': 'learning',
      'vigilance': 'vigilance',
      'inspiration': 'inspiration',
      'manipulation': 'manipulation',
      'observation': 'observation'
    },
    abilities: {
      'physique': 'phy',
      'précision': 'pre',
      'logique': 'log',
      'empathie': 'emp'
    },
    rollTypes: {
      'jet de compétence': 'skill',
      'attaque': 'attack',
      'dégâts': 'damage',
      'peur': 'fear'
    }
  }
}

const KULT_MAPPINGS = {
  en: {
    skills: {
      // Moves
      'engage in combat': 'engage_combat',
      'avoid harm': 'avoid_harm',
      'endure injury': 'endure_injury',
      'act under pressure': 'act_under_pressure',
      'influence other': 'influence_other',
      'read a person': 'read_person',
      'observe a situation': 'observe_situation',
      'investigate': 'investigate',
      'see through the illusion': 'see_illusion',
      'keep it together': 'keep_together',
      'help another': 'help_another',
      'hinder another': 'hinder_another'
    },
    abilities: {
      'fortitude': 'fortitude',
      'reflexes': 'reflexes',
      'willpower': 'willpower',
      'reason': 'reason',
      'intuition': 'intuition',
      'perception': 'perception',
      'coolness': 'coolness',
      'violence': 'violence',
      'charisma': 'charisma',
      'soul': 'soul'
    },
    rollTypes: {
      'move': 'move',
      'attribute': 'attribute',
      'harm': 'harm',
      'stability': 'stability'
    }
  },
  fr: {
    skills: {
      'engager le combat': 'engage_combat',
      'éviter le danger': 'avoid_harm',
      'endurer une blessure': 'endure_injury',
      'agir sous pression': 'act_under_pressure',
      'influencer autrui': 'influence_other',
      'lire une personne': 'read_person',
      'observer une situation': 'observe_situation',
      'enquêter': 'investigate',
      'voir à travers l\'illusion': 'see_illusion',
      'garder son sang-froid': 'keep_together',
      'aider quelqu\'un': 'help_another',
      'gêner quelqu\'un': 'hinder_another'
    },
    abilities: {
      'robustesse': 'fortitude',
      'réflexes': 'reflexes',
      'volonté': 'willpower',
      'raison': 'reason',
      'intuition': 'intuition',
      'perception': 'perception',
      'sang-froid': 'coolness',
      'violence': 'violence',
      'charisme': 'charisma',
      'âme': 'soul'
    },
    rollTypes: {
      'action': 'move',
      'attribut': 'attribute',
      'blessure': 'harm',
      'stabilité': 'stability'
    }
  }
}

const CAIRN_MAPPINGS = {
  en: {
    skills: {},
    abilities: {
      'strength': 'str',
      'str': 'str',
      'dexterity': 'dex',
      'dex': 'dex',
      'willpower': 'wil',
      'wil': 'wil'
    },
    rollTypes: {
      'save': 'save',
      'attack': 'attack',
      'damage': 'damage',
      'critical damage': 'critical'
    }
  },
  fr: {
    skills: {},
    abilities: {
      'force': 'str',
      'dextérité': 'dex',
      'volonté': 'wil'
    },
    rollTypes: {
      'sauvegarde': 'save',
      'attaque': 'attack',
      'dégâts': 'damage',
      'dégâts critiques': 'critical'
    }
  }
}

const MOTHERSHIP_MAPPINGS = {
  en: {
    skills: {
      // Combat
      'combat': 'combat',
      'firearms': 'firearms',
      'tactics': 'tactics',
      // Technical
      'computers': 'computers',
      'engineering': 'engineering',
      'mechanical repair': 'mechanical_repair',
      'electronics': 'electronics',
      'explosives': 'explosives',
      'jury-rigging': 'jury_rigging',
      // Science
      'biology': 'biology',
      'chemistry': 'chemistry',
      'physics': 'physics',
      'geology': 'geology',
      'planetology': 'planetology',
      'xenobiology': 'xenobiology',
      // Social
      'command': 'command',
      'persuade': 'persuade',
      'psychology': 'psychology',
      // Vehicle
      'driving': 'driving',
      'piloting': 'piloting',
      'rimwise': 'rimwise',
      // Survival
      'athletics': 'athletics',
      'first aid': 'first_aid',
      'wilderness survival': 'wilderness_survival',
      'zero-g': 'zero_g'
    },
    abilities: {
      'strength': 'str',
      'speed': 'spd',
      'intellect': 'int',
      'combat': 'cmb'
    },
    rollTypes: {
      'skill check': 'skill',
      'stat check': 'ability',
      'save': 'save',
      'panic check': 'panic',
      'sanity check': 'sanity',
      'fear': 'fear'
    }
  },
  fr: {
    skills: {
      'combat': 'combat',
      'armes à feu': 'firearms',
      'tactique': 'tactics',
      'informatique': 'computers',
      'ingénierie': 'engineering',
      'réparation mécanique': 'mechanical_repair',
      'électronique': 'electronics',
      'explosifs': 'explosives',
      'bricolage': 'jury_rigging',
      'biologie': 'biology',
      'chimie': 'chemistry',
      'physique': 'physics',
      'géologie': 'geology',
      'planétologie': 'planetology',
      'xénobiologie': 'xenobiology',
      'commandement': 'command',
      'persuasion': 'persuade',
      'psychologie': 'psychology',
      'conduite': 'driving',
      'pilotage': 'piloting',
      'athlétisme': 'athletics',
      'premiers soins': 'first_aid',
      'survie': 'wilderness_survival',
      'apesanteur': 'zero_g'
    },
    abilities: {
      'force': 'str',
      'vitesse': 'spd',
      'intellect': 'int',
      'combat': 'cmb'
    },
    rollTypes: {
      'test de compétence': 'skill',
      'test de caractéristique': 'ability',
      'sauvegarde': 'save',
      'test de panique': 'panic',
      'test de santé mentale': 'sanity',
      'peur': 'fear'
    }
  }
}

const DUNGEON_WORLD_MAPPINGS = {
  en: {
    skills: {
      'hack and slash': 'hack_slash',
      'volley': 'volley',
      'defy danger': 'defy_danger',
      'defend': 'defend',
      'spout lore': 'spout_lore',
      'discern realities': 'discern_realities',
      'parley': 'parley',
      'aid': 'aid',
      'interfere': 'interfere',
      'last breath': 'last_breath',
      'encumbrance': 'encumbrance',
      'make camp': 'make_camp',
      'undertake a perilous journey': 'perilous_journey',
      'level up': 'level_up',
      'end of session': 'end_session'
    },
    abilities: {
      'strength': 'str',
      'str': 'str',
      'dexterity': 'dex',
      'dex': 'dex',
      'constitution': 'con',
      'con': 'con',
      'intelligence': 'int',
      'int': 'int',
      'wisdom': 'wis',
      'wis': 'wis',
      'charisma': 'cha',
      'cha': 'cha'
    },
    rollTypes: {
      'move': 'move',
      'damage': 'damage',
      'basic move': 'basic',
      'class move': 'class'
    }
  },
  fr: {
    skills: {
      'tailler en pièces': 'hack_slash',
      'salve': 'volley',
      'défier le danger': 'defy_danger',
      'défendre': 'defend',
      'étaler sa science': 'spout_lore',
      'discerner la réalité': 'discern_realities',
      'parlementer': 'parley',
      'aider': 'aid',
      'interférer': 'interfere',
      'dernier souffle': 'last_breath'
    },
    abilities: {
      'force': 'str',
      'dextérité': 'dex',
      'constitution': 'con',
      'intelligence': 'int',
      'sagesse': 'wis',
      'charisme': 'cha'
    },
    rollTypes: {
      'action': 'move',
      'dégâts': 'damage',
      'action de base': 'basic',
      'action de classe': 'class'
    }
  }
}

const FATE_MAPPINGS = {
  en: {
    skills: {
      'athletics': 'athletics',
      'burglary': 'burglary',
      'contacts': 'contacts',
      'crafts': 'crafts',
      'deceive': 'deceive',
      'drive': 'drive',
      'empathy': 'empathy',
      'fight': 'fight',
      'investigate': 'investigate',
      'lore': 'lore',
      'notice': 'notice',
      'physique': 'physique',
      'provoke': 'provoke',
      'rapport': 'rapport',
      'resources': 'resources',
      'shoot': 'shoot',
      'stealth': 'stealth',
      'will': 'will'
    },
    abilities: {},
    rollTypes: {
      'overcome': 'overcome',
      'create advantage': 'create_advantage',
      'attack': 'attack',
      'defend': 'defend'
    }
  },
  fr: {
    skills: {
      'athlétisme': 'athletics',
      'cambriolage': 'burglary',
      'contacts': 'contacts',
      'artisanat': 'crafts',
      'tromperie': 'deceive',
      'conduite': 'drive',
      'empathie': 'empathy',
      'combat': 'fight',
      'investigation': 'investigate',
      'connaissance': 'lore',
      'attention': 'notice',
      'physique': 'physique',
      'provocation': 'provoke',
      'sociabilité': 'rapport',
      'ressources': 'resources',
      'tir': 'shoot',
      'discrétion': 'stealth',
      'volonté': 'will'
    },
    abilities: {},
    rollTypes: {
      'surmonter': 'overcome',
      'créer un avantage': 'create_advantage',
      'attaque': 'attack',
      'défense': 'defend'
    }
  }
}

// ============================================================================
// Additional Tier B Systems (simplified mappings)
// ============================================================================

const OSE_MAPPINGS = {
  en: {
    skills: {
      'open doors': 'open_doors',
      'find secret doors': 'find_secret',
      'hear noise': 'hear_noise',
      'find traps': 'find_traps',
      'remove traps': 'remove_traps',
      'climb walls': 'climb_walls',
      'move silently': 'move_silently',
      'hide in shadows': 'hide_shadows',
      'pick pockets': 'pick_pockets',
      'pick locks': 'pick_locks'
    },
    abilities: {
      'strength': 'str',
      'intelligence': 'int',
      'wisdom': 'wis',
      'dexterity': 'dex',
      'constitution': 'con',
      'charisma': 'cha'
    },
    rollTypes: {
      'attack roll': 'attack',
      'damage': 'damage',
      'saving throw': 'save',
      'ability check': 'ability',
      'thief skill': 'thief'
    }
  },
  fr: {
    skills: {
      'forcer les portes': 'open_doors',
      'trouver les portes secrètes': 'find_secret',
      'écouter': 'hear_noise',
      'trouver les pièges': 'find_traps',
      'désamorcer les pièges': 'remove_traps',
      'escalade': 'climb_walls',
      'déplacement silencieux': 'move_silently',
      'se cacher dans l\'ombre': 'hide_shadows',
      'pickpocket': 'pick_pockets',
      'crochetage': 'pick_locks'
    },
    abilities: {
      'force': 'str',
      'intelligence': 'int',
      'sagesse': 'wis',
      'dextérité': 'dex',
      'constitution': 'con',
      'charisme': 'cha'
    },
    rollTypes: {
      'jet d\'attaque': 'attack',
      'dégâts': 'damage',
      'jet de sauvegarde': 'save',
      'test de caractéristique': 'ability',
      'compétence de voleur': 'thief'
    }
  }
}

const SHADOW_OF_DEMON_LORD_MAPPINGS = {
  en: {
    skills: {},
    abilities: {
      'strength': 'str',
      'agility': 'agi',
      'intellect': 'int',
      'will': 'wil'
    },
    rollTypes: {
      'attack roll': 'attack',
      'damage': 'damage',
      'challenge roll': 'challenge',
      'fate roll': 'fate'
    }
  },
  fr: {
    skills: {},
    abilities: {
      'force': 'str',
      'agilité': 'agi',
      'intellect': 'int',
      'volonté': 'wil'
    },
    rollTypes: {
      'jet d\'attaque': 'attack',
      'dégâts': 'damage',
      'jet de défi': 'challenge',
      'jet de destin': 'fate'
    }
  }
}

const IRONSWORN_MAPPINGS = {
  en: {
    skills: {
      'face danger': 'face_danger',
      'secure an advantage': 'secure_advantage',
      'gather information': 'gather_info',
      'compel': 'compel',
      'strike': 'strike',
      'clash': 'clash',
      'battle': 'battle',
      'endure harm': 'endure_harm',
      'face death': 'face_death',
      'resupply': 'resupply',
      'make camp': 'make_camp',
      'undertake a journey': 'journey',
      'reach your destination': 'reach_destination'
    },
    abilities: {
      'edge': 'edge',
      'heart': 'heart',
      'iron': 'iron',
      'shadow': 'shadow',
      'wits': 'wits'
    },
    rollTypes: {
      'action roll': 'action',
      'progress roll': 'progress',
      'oracle': 'oracle'
    }
  },
  fr: {
    skills: {
      'affronter le danger': 'face_danger',
      'assurer un avantage': 'secure_advantage',
      'recueillir des informations': 'gather_info',
      'contraindre': 'compel',
      'frapper': 'strike',
      's\'affronter': 'clash',
      'combattre': 'battle',
      'endurer le mal': 'endure_harm',
      'affronter la mort': 'face_death',
      'se réapprovisionner': 'resupply',
      'établir le camp': 'make_camp',
      'entreprendre un voyage': 'journey',
      'atteindre la destination': 'reach_destination'
    },
    abilities: {
      'tranchant': 'edge',
      'coeur': 'heart',
      'fer': 'iron',
      'ombre': 'shadow',
      'esprit': 'wits'
    },
    rollTypes: {
      'jet d\'action': 'action',
      'jet de progression': 'progress',
      'oracle': 'oracle'
    }
  }
}

// ============================================================================
// GENERIC FALLBACK
// ============================================================================

const GENERIC_MAPPINGS = {
  en: {
    skills: {},
    abilities: {
      'strength': 'str',
      'str': 'str',
      'dexterity': 'dex',
      'dex': 'dex',
      'constitution': 'con',
      'con': 'con',
      'intelligence': 'int',
      'int': 'int',
      'wisdom': 'wis',
      'wis': 'wis',
      'charisma': 'cha',
      'cha': 'cha',
      'agility': 'agi',
      'willpower': 'wil',
      'perception': 'per'
    },
    rollTypes: {
      'attack': 'attack',
      'damage': 'damage',
      'save': 'save',
      'saving throw': 'save',
      'check': 'check',
      'skill': 'skill',
      'ability': 'ability',
      'initiative': 'initiative'
    }
  },
  fr: {
    skills: {},
    abilities: {
      'force': 'str',
      'dextérité': 'dex',
      'constitution': 'con',
      'intelligence': 'int',
      'sagesse': 'wis',
      'charisme': 'cha',
      'agilité': 'agi',
      'volonté': 'wil',
      'perception': 'per'
    },
    rollTypes: {
      'attaque': 'attack',
      'dégâts': 'damage',
      'sauvegarde': 'save',
      'jet de sauvegarde': 'save',
      'test': 'check',
      'compétence': 'skill',
      'caractéristique': 'ability',
      'initiative': 'initiative'
    }
  }
}

// ============================================================================
// EXPORT ALL MAPPINGS
// ============================================================================

export const SYSTEM_MAPPINGS = {
  // Tier S
  'dnd5e': DND5E_MAPPINGS,
  'pf2e': PF2E_MAPPINGS,
  'pf1': PF1_MAPPINGS,
  'wfrp4e': WFRP4E_MAPPINGS,
  'lancer': LANCER_MAPPINGS,
  'cyberpunk-red-core': CYBERPUNK_RED_MAPPINGS,
  'CoC7': COC7_MAPPINGS,
  'swade': SWADE_MAPPINGS,

  // Tier A
  'sfrpg': STARFINDER_MAPPINGS,
  'starwarsffg': STAR_WARS_FFG_MAPPINGS,
  'wod5e': WOD5E_MAPPINGS,
  'alienrpg': ALIEN_RPG_MAPPINGS,
  'wrath-and-glory': WRATH_AND_GLORY_MAPPINGS,
  'deltagreen': DELTA_GREEN_MAPPINGS,
  'forbidden-lands': FORBIDDEN_LANDS_MAPPINGS,

  // Tier B
  'blades-in-the-dark': BLADES_IN_THE_DARK_MAPPINGS,
  'morkborg': MORK_BORG_MAPPINGS,
  'vaesen': VAESEN_MAPPINGS,
  'k4lt': KULT_MAPPINGS,
  'kult-divinity-lost': KULT_MAPPINGS,
  'cairn': CAIRN_MAPPINGS,
  'mosh': MOTHERSHIP_MAPPINGS,
  'mothership': MOTHERSHIP_MAPPINGS,
  'dungeonworld': DUNGEON_WORLD_MAPPINGS,
  'fate-core-official': FATE_MAPPINGS,
  'ose': OSE_MAPPINGS,
  'demonlord': SHADOW_OF_DEMON_LORD_MAPPINGS,
  'foundry-ironsworn': IRONSWORN_MAPPINGS,

  // Fallback
  'generic': GENERIC_MAPPINGS
}

/**
 * Get mappings for a specific system and language
 * Falls back to English if language not found, then to generic if system not found
 */
export function getSystemMappings(systemId, language = 'en') {
  const systemMappings = SYSTEM_MAPPINGS[systemId] || SYSTEM_MAPPINGS['generic']
  return systemMappings[language] || systemMappings['en'] || GENERIC_MAPPINGS['en']
}

export default SYSTEM_MAPPINGS
