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
    history: 'Historique',
    settings: 'Paramètres',
    primary: 'Navigation principale',
  },
  home: {
    title: 'Quiz de géographie',
    tagline: 'Apprenez la géographie du monde avec des cartes et des drapeaux.',
    demo: 'Bienvenue — prêt à explorer le monde ?',
    play: 'Commencer à jouer',
    train: 'Réviser mes erreurs',
    trainCount: 'Réviser mes erreurs ({count})',
    trainHint:
      'La révision cible les pays que vous manquez — jouez quelques parties pour la nourrir.',
  },
  modes: {
    flagToCountry: 'Drapeau → Pays',
    countryToFlag: 'Pays → Drapeau',
    mapHighlight: 'Trouver le pays surligné',
    mapLocate: 'Localiser sur la carte',
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
      regionWorld: 'Monde (tous les pays)',
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
