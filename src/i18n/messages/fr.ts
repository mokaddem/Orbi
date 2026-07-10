import type en from './en';

const fr: typeof en = {
  app: {
    title: 'Quiz de géographie',
  },
  common: {
    cancel: 'Annuler',
  },
  nav: {
    home: 'Accueil',
    play: 'Jouer',
    atlas: 'Atlas',
    history: 'Historique',
    settings: 'Paramètres',
    primary: 'Navigation principale',
  },
  atlas: {
    title: 'Atlas',
    intro: 'Parcourez tous les pays et régions — sans quiz, juste pour explorer.',
    searchPlaceholder: 'Rechercher un pays…',
    searchLabel: 'Rechercher un pays',
    regionsTitle: 'Régions',
    countriesTitle: 'Tous les pays',
    resultsTitle: 'Résultats',
    noResults: 'Aucun pays ne correspond à « {query} ».',
    countryCount: '{count} pays',
    mapLabel: '{region} en surbrillance sur la carte du monde',
    regionNotFound: 'Région introuvable.',
    countryNotFound: 'Pays introuvable.',
    backToAtlas: 'Retour à l’Atlas',
    regionLabel: 'Région',
    subregionLabel: 'Sous-région',
    capitalLabel: 'Capitale',
  },
  home: {
    title: 'Quiz de géographie',
    tagline: 'Apprenez la géographie du monde avec des cartes et des drapeaux.',
    demo: 'Bienvenue — prêt à explorer le monde ?',
    play: 'Commencer à jouer',
    playCustom: 'Ou lancer une partie personnalisée',
    train: 'Réviser mes erreurs',
    trainCount: 'Réviser mes erreurs ({count})',
    trainAll: 'Réviser toutes mes erreurs ({count})',
    caughtUp: 'Vous êtes à jour — aucune erreur à revoir !',
    trainHint:
      'La révision cible les pays que vous manquez — jouez quelques parties pour la nourrir.',
    streak: {
      days: 'Série de {count} jours',
      playedToday: "Joué aujourd'hui ✓",
      keepGoing: 'Jouez aujourd’hui pour continuer',
      start: 'Lancez une série aujourd’hui',
    },
  },
  daily: {
    label: 'Défi du jour',
    title: 'Le défi du jour',
    world: 'Monde',
    play: 'Jouer',
    playAgain: 'Rejouer',
    done: "Terminé pour aujourd'hui ✓",
    score: 'Score : {correct}/{total}',
  },
  recommend: {
    label: 'À suivre',
    due: {
      title: "C'est l'heure de réviser",
      reason: '{count} à réviser — les plus fragiles d’abord.',
      cta: 'Réviser',
    },
    weakSpot: {
      title: 'Renforcez : {region}',
      reason: '{percent} de réussite jusqu’ici.',
      cta: 'S’entraîner',
    },
    fresh: {
      title: 'Prêt à jouer',
      reason: 'Choisissez un mode et une région pour commencer.',
      cta: 'Jouer',
    },
  },
  modes: {
    flagToCountry: 'Drapeau → Pays',
    countryToFlag: 'Pays → Drapeau',
    mapHighlight: 'Trouver le pays surligné',
    mapLocate: 'Localiser sur la carte',
    capitalToCountry: 'Capitale → Pays',
    countryToCapital: 'Pays → Capitale',
    countryToLanguages: 'Langues nationales',
  },
  sessionType: {
    fixed: 'Fixe',
    survival: 'Survie',
    training: 'Entraînement',
  },
  play: {
    title: 'Jouer',
    setup: {
      chooseMode: 'Choisissez un mode',
      chooseType: 'Choisissez un format',
      chooseRegion: 'Choisissez une région',
      regionWorld: 'Monde',
      subregionAll: 'Toute la région : {region}',
      poolCount: '{count} pays',
      poolReduced: '{count} pays — options réduites à {choices}',
      fixedHint: '{count} questions',
      survivalHint: '{lives} vies',
      start: 'Commencer',
    },
    prompt: {
      whichCountry: 'Quel est ce pays ?',
      whichFlag: 'Quel est son drapeau ?',
      whichHighlighted: 'Quel est le pays surligné ?',
      locate: 'Trouvez-le sur la carte',
      whichCountryOfCapital: 'De quel pays est-ce la capitale ?',
      whichCapital: 'Quelle est sa capitale ?',
      whichLanguages: 'Sélectionnez les {count} langues parlées ici',
    },
    multi: {
      submit: 'Valider ({count})',
    },
    map: {
      loading: 'Chargement de la carte…',
      error: 'Impossible de charger la carte.',
      label: 'Carte du monde',
    },
    progress: {
      question: 'Question {current} / {total}',
      answered: 'Répondu : {count}',
      lives: 'Vies',
      score: 'Score : {correct}/{total}',
      streak: 'Série : {streak}',
    },
    feedback: {
      correct: 'Correct !',
      wrong: 'Pas tout à fait',
      reveal: 'C’est {country}',
      revealLanguages: '{country} : {languages}',
    },
    quit: 'Quitter',
  },
  summary: {
    title: 'Résumé de la session',
    empty: 'Aucun résultat pour l’instant — jouez d’abord une session.',
    playNow: 'Jouer maintenant',
    score: 'Score',
    accuracy: 'Précision',
    time: 'Temps',
    bestStreak: 'Meilleure série',
    missedTitle: 'Manqués ({count})',
    noneMissed: 'Parfait — aucun manqué !',
    retry: 'Rejouer',
    train: 'Réviser ceux-ci',
    trainThese: 'Réviser les pays que vous venez de manquer',
    trainNone: 'Aucun manqué — rien à réviser',
    newGame: 'Nouvelle partie',
  },
  history: {
    title: 'Historique et statistiques',
    loading: 'Chargement de votre historique…',
    empty: 'Aucune session pour l’instant — jouez une partie pour suivre votre progression.',
    play: 'Jouer maintenant',
    stats: {
      sessions: 'Sessions',
      accuracy: 'Précision',
      avgTime: 'Moy. / question',
      playTime: 'Temps de jeu',
    },
    timeline: {
      title: 'Sessions par jour',
      truncated: 'Affichage des {days} derniers jours actifs.',
      tooltip: '{date} : {count} sessions, {correct}/{questions} correctes',
    },
    missed: {
      title: 'Pays les plus manqués',
      none: 'Aucune erreur enregistrée — bravo !',
      ratio: '{misses} manqués sur {attempts}',
    },
    recent: {
      title: 'Sessions récentes',
    },
    clear: 'Effacer l’historique',
    clearConfirm: 'Supprimer toutes les sessions enregistrées ? Cette action est irréversible.',
  },
  progress: {
    mastery: {
      title: 'Maîtrise du monde',
      learned: '{mastered} pays sur {total} appris',
      regionsTitle: 'Maîtrise par région',
      regionCount: '{mastered}/{total}',
    },
    capitalMastery: {
      title: 'Capitales',
      learned: '{mastered} capitales sur {total} apprises',
      regionsTitle: 'Capitales par région',
    },
    languageMastery: {
      title: 'Langues',
      learned: 'Langues de {mastered} pays sur {total} apprises',
      regionsTitle: 'Langues par région',
    },
    extras: {
      title: 'Connaissances complémentaires',
      subtitle: 'Suivies séparément de la maîtrise des pays.',
      badgesTitle: 'Badges',
      showRegions: 'Par région',
      hideRegions: 'Masquer les régions',
    },
    achievements: {
      title: 'Réussites',
      earned: '{earned} sur {total} obtenues',
      unlocked: 'Réussite débloquée !',
      dismiss: 'Fermer',
      badges: {
        'first-round': { title: 'Première partie', desc: 'Terminez votre première session.' },
        'perfect-fixed': {
          title: 'Sans faute',
          desc: 'Terminez une partie à questions fixes sans aucune erreur.',
        },
        'flawless-survival': {
          title: 'Survivant',
          desc: 'Terminez une partie survie sans la moindre erreur.',
        },
        speedy: {
          title: 'Rapide comme l’éclair',
          desc: 'Moins de 3 secondes par réponse en moyenne sur une partie de 5 questions ou plus.',
        },
        'streak-7': { title: 'Semaine complète', desc: 'Jouez 7 jours d’affilée.' },
        'streak-30': { title: 'Mois complet', desc: 'Jouez 30 jours d’affilée.' },
        'region-mastered': {
          title: 'Maître d’une région',
          desc: 'Maîtrisez tous les pays d’une même région.',
        },
        'mastered-europe': {
          title: 'Europe maîtrisée',
          desc: 'Maîtrisez tous les pays d’Europe.',
        },
        'mastered-africa': {
          title: 'Afrique maîtrisée',
          desc: 'Maîtrisez tous les pays d’Afrique.',
        },
        'mastered-asia': { title: 'Asie maîtrisée', desc: 'Maîtrisez tous les pays d’Asie.' },
        'mastered-americas': {
          title: 'Amériques maîtrisées',
          desc: 'Maîtrisez tous les pays des Amériques.',
        },
        'mastered-oceania': {
          title: 'Océanie maîtrisée',
          desc: 'Maîtrisez tous les pays d’Océanie.',
        },
        century: { title: 'Centurion', desc: 'Maîtrisez 100 pays.' },
        'world-mastered': { title: 'Maître du monde', desc: 'Maîtrisez tous les pays du monde.' },
        'capitals-collector': {
          title: 'Collectionneur de capitales',
          desc: 'Maîtrisez 25 capitales.',
        },
        'capitals-europe': {
          title: "Capitales d'Europe",
          desc: 'Maîtrisez la capitale de chaque pays d’Europe.',
        },
        'capitals-africa': {
          title: "Capitales d'Afrique",
          desc: 'Maîtrisez la capitale de chaque pays d’Afrique.',
        },
        'capitals-asia': {
          title: "Capitales d'Asie",
          desc: 'Maîtrisez la capitale de chaque pays d’Asie.',
        },
        'capitals-americas': {
          title: 'Capitales des Amériques',
          desc: 'Maîtrisez la capitale de chaque pays des Amériques.',
        },
        'capitals-oceania': {
          title: "Capitales d'Océanie",
          desc: 'Maîtrisez la capitale de chaque pays d’Océanie.',
        },
        'capitals-century': { title: 'Érudit des capitales', desc: 'Maîtrisez 100 capitales.' },
        'capitals-world': {
          title: 'Maître des capitales',
          desc: 'Maîtrisez toutes les capitales du monde.',
        },
        'languages-collector': {
          title: 'Polyglotte en herbe',
          desc: 'Maîtrisez les langues de 25 pays.',
        },
        'languages-europe': {
          title: 'Langues d’Europe',
          desc: 'Maîtrisez les langues de tous les pays d’Europe.',
        },
        'languages-africa': {
          title: 'Langues d’Afrique',
          desc: 'Maîtrisez les langues de tous les pays d’Afrique.',
        },
        'languages-asia': {
          title: 'Langues d’Asie',
          desc: 'Maîtrisez les langues de tous les pays d’Asie.',
        },
        'languages-americas': {
          title: 'Langues des Amériques',
          desc: 'Maîtrisez les langues de tous les pays des Amériques.',
        },
        'languages-oceania': {
          title: 'Langues d’Océanie',
          desc: 'Maîtrisez les langues de tous les pays d’Océanie.',
        },
        'languages-century': {
          title: 'Érudit des langues',
          desc: 'Maîtrisez les langues de 100 pays.',
        },
        'languages-world': {
          title: 'Linguiste du monde',
          desc: 'Maîtrisez les langues de tous les pays du monde.',
        },
      },
    },
    recap: {
      title: 'Cette semaine',
      empty: 'Rien cette semaine pour l’instant — jouez une partie pour la remplir.',
      sessions: 'Sessions',
      accuracy: 'Précision',
      questions: 'Questions',
      mastered: 'Nouvellement maîtrisés',
      streak: 'Jours de série',
    },
  },
  settings: {
    title: 'Paramètres',
    language: 'Langue',
    gameplay: 'Jeu',
    fixedLength: 'Questions par partie fixe',
    survivalLives: 'Vies en mode survie',
    choices: 'Choix de réponse par question',
    hint: 'Les changements s’appliquent à votre prochaine partie.',
    notPersisted:
      'Le stockage est indisponible — les paramètres et l’historique ne seront pas enregistrés.',
    data: {
      title: 'Données',
      historyLabel: 'Historique de jeu',
      historyHint: 'Toutes les sessions et statistiques enregistrées.',
      clearHistory: 'Effacer l’historique',
      clearHistoryTitle: 'Effacer l’historique ?',
      clearHistoryMessage:
        'Cela supprime définitivement toutes les sessions et statistiques enregistrées. Cette action est irréversible.',
      trainingLabel: 'Progression de révision',
      trainingHint: 'Les pays que « Réviser mes erreurs » a mis en file d’attente.',
      resetTraining: 'Réinitialiser la révision',
      resetTrainingTitle: 'Réinitialiser la révision ?',
      resetTrainingMessage:
        'Cela efface définitivement votre progression de révision. Cette action est irréversible.',
    },
    scope: {
      title: 'Pays pris en compte',
      body: 'Cette application couvre les 195 États souverains largement reconnus : les 193 États membres de l’ONU ainsi que les deux États observateurs de l’ONU — le Saint-Siège (Cité du Vatican) et l’État de Palestine.',
      excludes:
        'Il s’agit d’une base pragmatique et largement admise, et non d’une prise de position politique. Certains lieux sont donc exclus : des États partiellement reconnus comme Taïwan et le Kosovo, et des territoires dépendants comme le Groenland, Porto Rico ou Hong Kong, administrés comme partie d’un autre pays.',
      note: 'Les noms de pays, les drapeaux et les régions suivent tous cette même liste.',
    },
  },
  storage: {
    unavailable:
      'Le stockage est indisponible dans ce navigateur — votre progression ne sera pas enregistrée.',
  },
  notFound: {
    title: 'Page introuvable',
    back: "Retour à l'accueil",
  },
};

export default fr;
