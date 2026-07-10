// @ts-check
/**
 * Phase 32 — Curated "why" fun facts for the industries mode (answer explanations).
 *
 * When a player answers a `country-to-industry` question **wrong**, the reveal shows a short,
 * memorable "Did you know?" line explaining *why* the correct industry is one the country is
 * known for (e.g. UAE → oil & gas). This file IS the content: a hand-authored map keyed by
 * `iso2 → industryKey → { en, fr, de }`, assembled onto each `IndustryRef` by
 * `scripts/build-data.mjs`.
 *
 * ┌─ SCOPE & SOURCING ──────────────────────────────────────────────────────────────────┐
 * │ • Pilot coverage (owner choice, "Option A"): full facts for the ~58 most-recognisable │
 * │   economies — every industry each country carries in `industries.mjs`. Every other    │
 * │   (country, industry) pair simply ships no fact and the reveal omits the blurb; the   │
 * │   store grows over time. There is NO exhaustiveness requirement (unlike industries).  │
 * │ • Facts are not copyrightable. Authored from general knowledge and public-domain       │
 * │   references (e.g. the CIA World Factbook "Economy" field). Offline, redistributable.  │
 * │ • Durable phrasing by owner decision: prefer timeless wording; a figure appears only   │
 * │   with a stated year (e.g. a founding date), never a volatile "X% of GDP" that ages.   │
 * │ • One crisp sentence per language, in the friendly house voice. Trilingual parity is   │
 * │   enforced by the build: every shipped fact must have a non-empty en / fr / de.        │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * INTEGRITY (enforced in build-data.mjs): every entry's `iso2` must be in scope, every
 * `industryKey` must be one the country actually carries in `COUNTRY_INDUSTRIES` (so a fact
 * can never point at an industry the quiz won't show), and all three languages must be filled.
 *
 * @type {Record<string, Record<string, { en: string; fr: string; de: string }>>}
 */
export const INDUSTRY_FACTS = {
  // ── Europe ────────────────────────────────────────────────────────────────────────────
  FR: {
    'aerospace-defence': {
      en: 'France is home to Airbus and Dassault, making aerospace and defence one of its flagship high-tech exports.',
      fr: 'La France abrite Airbus et Dassault, faisant de l’aéronautique et de la défense l’une de ses exportations high-tech phares.',
      de: 'In Frankreich sind Airbus und Dassault beheimatet, was Luftfahrt und Verteidigung zu einem seiner wichtigsten Hightech-Exporte macht.',
    },
    automotive: {
      en: 'Renault, Peugeot and Citroën have made carmaking a pillar of French industry for over a century.',
      fr: 'Renault, Peugeot et Citroën ont fait de l’automobile un pilier de l’industrie française depuis plus d’un siècle.',
      de: 'Renault, Peugeot und Citroën haben die Automobilherstellung seit über einem Jahrhundert zu einer Säule der französischen Industrie gemacht.',
    },
    tourism: {
      en: 'France has long been the world’s most-visited country, drawing travellers to Paris, the Riviera and its vineyards.',
      fr: 'La France est depuis longtemps le pays le plus visité au monde, attirant les voyageurs à Paris, sur la Riviera et dans ses vignobles.',
      de: 'Frankreich ist seit Langem das meistbesuchte Land der Welt und zieht Reisende nach Paris, an die Riviera und in seine Weinberge.',
    },
    'food-beverages': {
      en: 'French wine, cheese and gastronomy underpin a food-and-drink industry famous worldwide.',
      fr: 'Le vin, le fromage et la gastronomie français sont à la base d’une industrie agroalimentaire mondialement réputée.',
      de: 'Französischer Wein, Käse und die Gastronomie bilden die Grundlage einer weltweit berühmten Lebensmittel- und Getränkeindustrie.',
    },
    pharmaceuticals: {
      en: 'Sanofi, one of the world’s largest drugmakers, anchors a strong French pharmaceutical sector.',
      fr: 'Sanofi, l’un des plus grands laboratoires au monde, ancre un secteur pharmaceutique français solide.',
      de: 'Sanofi, einer der größten Arzneimittelhersteller der Welt, verankert einen starken französischen Pharmasektor.',
    },
  },
  DE: {
    automotive: {
      en: 'Volkswagen, Mercedes-Benz and BMW make cars Germany’s signature export and its largest industry.',
      fr: 'Volkswagen, Mercedes-Benz et BMW font de l’automobile l’exportation emblématique et la plus grande industrie de l’Allemagne.',
      de: 'Volkswagen, Mercedes-Benz und BMW machen Autos zum charakteristischen Exportgut und zur größten Industrie Deutschlands.',
    },
    machinery: {
      en: 'German "Mittelstand" engineering firms lead the world in specialised machinery and equipment.',
      fr: 'Les entreprises d’ingénierie du « Mittelstand » allemand dominent le monde des machines et équipements spécialisés.',
      de: 'Deutsche „Mittelstand“-Ingenieurunternehmen sind weltweit führend bei Spezialmaschinen und -ausrüstung.',
    },
    chemicals: {
      en: 'BASF runs the world’s largest integrated chemical complex at Ludwigshafen.',
      fr: 'BASF exploite à Ludwigshafen le plus grand complexe chimique intégré du monde.',
      de: 'BASF betreibt in Ludwigshafen den größten integrierten Chemiekomplex der Welt.',
    },
    electronics: {
      en: 'Siemens and Bosch keep Germany at the forefront of industrial electronics.',
      fr: 'Siemens et Bosch maintiennent l’Allemagne à la pointe de l’électronique industrielle.',
      de: 'Siemens und Bosch halten Deutschland an der Spitze der Industrieelektronik.',
    },
    pharmaceuticals: {
      en: 'Bayer, founded in 1863, gave the world aspirin and still anchors German pharma.',
      fr: 'Bayer, fondé en 1863, a donné l’aspirine au monde et reste un pilier de la pharmacie allemande.',
      de: 'Bayer, gegründet 1863, schenkte der Welt das Aspirin und ist bis heute ein Eckpfeiler der deutschen Pharmaindustrie.',
    },
  },
  GB: {
    finance: {
      en: 'The City of London is one of the world’s two leading financial centres, alongside New York.',
      fr: 'La City de Londres est l’un des deux principaux centres financiers mondiaux, avec New York.',
      de: 'Die City of London ist neben New York eines der beiden weltweit führenden Finanzzentren.',
    },
    'aerospace-defence': {
      en: 'Rolls-Royce jet engines and BAE Systems make aerospace and defence a British strength.',
      fr: 'Les moteurs Rolls-Royce et BAE Systems font de l’aéronautique et de la défense un point fort britannique.',
      de: 'Rolls-Royce-Triebwerke und BAE Systems machen Luftfahrt und Verteidigung zu einer britischen Stärke.',
    },
    pharmaceuticals: {
      en: 'GSK and AstraZeneca give Britain one of the world’s strongest pharmaceutical industries.',
      fr: 'GSK et AstraZeneca dotent le Royaume-Uni de l’une des industries pharmaceutiques les plus solides au monde.',
      de: 'GSK und AstraZeneca verleihen Großbritannien eine der stärksten Pharmaindustrien der Welt.',
    },
    automotive: {
      en: 'Britain is the birthplace of marques like Jaguar, Land Rover and Mini, still built there today.',
      fr: 'Le Royaume-Uni est le berceau de marques comme Jaguar, Land Rover et Mini, toujours produites sur place.',
      de: 'Großbritannien ist die Heimat von Marken wie Jaguar, Land Rover und Mini, die dort noch heute gebaut werden.',
    },
  },
  IT: {
    automotive: {
      en: 'Ferrari, Fiat and Lamborghini make Italy famous for both mass-market and luxury cars.',
      fr: 'Ferrari, Fiat et Lamborghini rendent l’Italie célèbre pour ses voitures de grande série comme de luxe.',
      de: 'Ferrari, Fiat und Lamborghini machen Italien für Massen- wie Luxusautos berühmt.',
    },
    machinery: {
      en: 'Italy is a world leader in industrial machinery, from packaging lines to machine tools.',
      fr: 'L’Italie est un leader mondial des machines industrielles, des lignes d’emballage aux machines-outils.',
      de: 'Italien ist weltweit führend bei Industriemaschinen, von Verpackungsanlagen bis zu Werkzeugmaschinen.',
    },
    textiles: {
      en: 'Italian fashion houses like Armani and Prada anchor a renowned textile and apparel industry.',
      fr: 'Les maisons de mode italiennes comme Armani et Prada ancrent une industrie textile et de l’habillement renommée.',
      de: 'Italienische Modehäuser wie Armani und Prada verankern eine renommierte Textil- und Bekleidungsindustrie.',
    },
    tourism: {
      en: 'Italy holds more UNESCO World Heritage sites than any other country, fuelling mass tourism.',
      fr: 'L’Italie compte plus de sites du patrimoine mondial de l’UNESCO que tout autre pays, alimentant un tourisme de masse.',
      de: 'Italien besitzt mehr UNESCO-Welterbestätten als jedes andere Land, was den Massentourismus antreibt.',
    },
    'food-beverages': {
      en: 'Pasta, olive oil and wine make Italian food and drink a global export.',
      fr: 'Les pâtes, l’huile d’olive et le vin font de l’agroalimentaire italien une exportation mondiale.',
      de: 'Pasta, Olivenöl und Wein machen italienische Lebensmittel und Getränke zu einem globalen Exportgut.',
    },
  },
  ES: {
    tourism: {
      en: 'Spain is one of the world’s top holiday destinations, with beaches, Gaudí and the Camino.',
      fr: 'L’Espagne est l’une des premières destinations de vacances au monde, avec ses plages, Gaudí et le Camino.',
      de: 'Spanien ist eines der weltweit beliebtesten Urlaubsziele, mit Stränden, Gaudí und dem Jakobsweg.',
    },
    automotive: {
      en: 'Spain is one of Europe’s largest car producers, assembling for SEAT and many foreign brands.',
      fr: 'L’Espagne est l’un des plus grands producteurs automobiles d’Europe, assemblant pour SEAT et de nombreuses marques étrangères.',
      de: 'Spanien ist einer der größten Autoproduzenten Europas und fertigt für SEAT und viele ausländische Marken.',
    },
    agriculture: {
      en: 'Spain is the world’s leading olive-oil producer and a major exporter of fruit and wine.',
      fr: 'L’Espagne est le premier producteur mondial d’huile d’olive et un grand exportateur de fruits et de vin.',
      de: 'Spanien ist der weltweit führende Olivenölproduzent und ein bedeutender Exporteur von Obst und Wein.',
    },
    'food-beverages': {
      en: 'Spanish staples like olive oil, jamón and wine underpin a big food-and-drink sector.',
      fr: 'Des produits phares espagnols comme l’huile d’olive, le jamón et le vin soutiennent un vaste secteur agroalimentaire.',
      de: 'Spanische Grundnahrungsmittel wie Olivenöl, Jamón und Wein stützen einen großen Lebensmittel- und Getränkesektor.',
    },
  },
  NL: {
    chemicals: {
      en: 'The Netherlands hosts major chemical clusters around Rotterdam’s vast port.',
      fr: 'Les Pays-Bas abritent d’importants pôles chimiques autour du vaste port de Rotterdam.',
      de: 'Die Niederlande beherbergen große Chemiecluster rund um den riesigen Hafen von Rotterdam.',
    },
    agriculture: {
      en: 'Despite its small size, the Netherlands is the world’s second-largest agricultural exporter.',
      fr: 'Malgré sa petite taille, les Pays-Bas sont le deuxième exportateur agricole mondial.',
      de: 'Trotz seiner geringen Größe sind die Niederlande der zweitgrößte Agrarexporteur der Welt.',
    },
    shipping: {
      en: 'Rotterdam is Europe’s largest seaport, the gateway for goods across the continent.',
      fr: 'Rotterdam est le plus grand port maritime d’Europe, la porte d’entrée des marchandises sur le continent.',
      de: 'Rotterdam ist Europas größter Seehafen, das Tor für Waren auf dem gesamten Kontinent.',
    },
    electronics: {
      en: 'ASML in the Netherlands builds the machines that make the world’s most advanced chips.',
      fr: 'ASML, aux Pays-Bas, fabrique les machines qui produisent les puces les plus avancées au monde.',
      de: 'Das niederländische Unternehmen ASML baut die Maschinen, die die fortschrittlichsten Chips der Welt herstellen.',
    },
    finance: {
      en: 'Amsterdam, home to the world’s oldest stock exchange (1602), is a major financial hub.',
      fr: 'Amsterdam, siège de la plus ancienne bourse du monde (1602), est un grand centre financier.',
      de: 'Amsterdam, Sitz der ältesten Börse der Welt (1602), ist ein bedeutender Finanzplatz.',
    },
  },
  CH: {
    finance: {
      en: 'Swiss banks like UBS make the country a global hub for wealth management.',
      fr: 'Les banques suisses comme UBS font du pays une plaque tournante mondiale de la gestion de fortune.',
      de: 'Schweizer Banken wie UBS machen das Land zu einem globalen Zentrum der Vermögensverwaltung.',
    },
    pharmaceuticals: {
      en: 'Basel is home to Novartis and Roche, giving Switzerland outsized pharma clout.',
      fr: 'Bâle abrite Novartis et Roche, conférant à la Suisse un poids pharmaceutique démesuré.',
      de: 'Basel ist die Heimat von Novartis und Roche und verleiht der Schweiz überproportionalen Einfluss in der Pharmabranche.',
    },
    machinery: {
      en: 'Precision engineering and watchmaking underpin Swiss machinery and equipment.',
      fr: 'L’ingénierie de précision et l’horlogerie sont à la base des machines et équipements suisses.',
      de: 'Präzisionstechnik und Uhrmacherei bilden die Grundlage der Schweizer Maschinen und Ausrüstung.',
    },
    'food-beverages': {
      en: 'Nestlé, the world’s biggest food company, is headquartered in Switzerland.',
      fr: 'Nestlé, la plus grande entreprise alimentaire du monde, a son siège en Suisse.',
      de: 'Nestlé, der größte Lebensmittelkonzern der Welt, hat seinen Sitz in der Schweiz.',
    },
  },
  SE: {
    automotive: {
      en: 'Volvo and Scania make vehicles a cornerstone of Swedish manufacturing.',
      fr: 'Volvo et Scania font des véhicules une pierre angulaire de l’industrie suédoise.',
      de: 'Volvo und Scania machen Fahrzeuge zu einem Eckpfeiler der schwedischen Fertigung.',
    },
    machinery: {
      en: 'Sweden’s engineering firms, from SKF to Atlas Copco, are world leaders in machinery.',
      fr: 'Les entreprises d’ingénierie suédoises, de SKF à Atlas Copco, sont des leaders mondiaux des machines.',
      de: 'Schwedens Ingenieurunternehmen, von SKF bis Atlas Copco, sind weltweit führend im Maschinenbau.',
    },
    'timber-paper': {
      en: 'Vast forests make Sweden one of the world’s biggest exporters of paper and timber.',
      fr: 'De vastes forêts font de la Suède l’un des plus grands exportateurs de papier et de bois du monde.',
      de: 'Ausgedehnte Wälder machen Schweden zu einem der größten Exporteure von Papier und Holz weltweit.',
    },
    'aerospace-defence': {
      en: 'Saab builds the Gripen fighter jet, a symbol of Swedish aerospace and defence.',
      fr: 'Saab construit l’avion de chasse Gripen, symbole de l’aéronautique et de la défense suédoises.',
      de: 'Saab baut den Kampfjet Gripen, ein Symbol der schwedischen Luftfahrt und Verteidigung.',
    },
  },
  NO: {
    'oil-gas': {
      en: 'North Sea oil and gas transformed Norway into one of the world’s wealthiest nations.',
      fr: 'Le pétrole et le gaz de la mer du Nord ont fait de la Norvège l’une des nations les plus riches du monde.',
      de: 'Öl und Gas aus der Nordsee machten Norwegen zu einer der wohlhabendsten Nationen der Welt.',
    },
    fishing: {
      en: 'Norway is one of the world’s largest seafood exporters, famous for its farmed salmon.',
      fr: 'La Norvège est l’un des plus grands exportateurs de produits de la mer, réputée pour son saumon d’élevage.',
      de: 'Norwegen ist einer der größten Meeresfrüchte-Exporteure der Welt und berühmt für seinen Zuchtlachs.',
    },
    shipping: {
      en: 'Norway has one of the world’s largest and most modern merchant fleets.',
      fr: 'La Norvège possède l’une des plus grandes et modernes flottes marchandes du monde.',
      de: 'Norwegen verfügt über eine der größten und modernsten Handelsflotten der Welt.',
    },
    energy: {
      en: 'Steep fjords let Norway generate almost all its electricity from hydropower.',
      fr: 'Ses fjords escarpés permettent à la Norvège de produire presque toute son électricité grâce à l’hydroélectricité.',
      de: 'Steile Fjorde ermöglichen es Norwegen, fast seinen gesamten Strom aus Wasserkraft zu gewinnen.',
    },
  },
  IE: {
    pharmaceuticals: {
      en: 'Low taxes have drawn most of the world’s big drugmakers to manufacture in Ireland.',
      fr: 'Une fiscalité avantageuse a attiré la plupart des grands laboratoires mondiaux à produire en Irlande.',
      de: 'Niedrige Steuern haben die meisten großen Arzneimittelhersteller der Welt zur Produktion nach Irland gelockt.',
    },
    'it-software': {
      en: 'Dublin hosts the European headquarters of Google, Meta and many other tech giants.',
      fr: 'Dublin accueille le siège européen de Google, Meta et de nombreux autres géants de la tech.',
      de: 'Dublin beherbergt die Europazentralen von Google, Meta und vielen anderen Tech-Giganten.',
    },
    finance: {
      en: 'Dublin’s IFSC has made Ireland a base for global fund administration and banking.',
      fr: 'L’IFSC de Dublin a fait de l’Irlande une base pour l’administration de fonds et la banque mondiales.',
      de: 'Dublins IFSC hat Irland zu einem Standort für globale Fondsverwaltung und Banken gemacht.',
    },
    'food-beverages': {
      en: 'Irish dairy and Guinness stout are exported around the world.',
      fr: 'Les produits laitiers irlandais et la stout Guinness s’exportent dans le monde entier.',
      de: 'Irische Milchprodukte und Guinness-Stout werden in die ganze Welt exportiert.',
    },
  },
  BE: {
    chemicals: {
      en: 'Antwerp hosts Europe’s largest chemicals cluster after Rotterdam.',
      fr: 'Anvers abrite le plus grand pôle chimique d’Europe après Rotterdam.',
      de: 'Antwerpen beherbergt nach Rotterdam das größte Chemiecluster Europas.',
    },
    pharmaceuticals: {
      en: 'Belgium punches above its weight in pharmaceuticals and vaccine production.',
      fr: 'La Belgique joue un rôle démesuré dans la pharmacie et la production de vaccins.',
      de: 'Belgien spielt in der Pharma- und Impfstoffproduktion eine überragende Rolle.',
    },
    shipping: {
      en: 'The port of Antwerp is one of Europe’s busiest, handling goods for the whole EU.',
      fr: 'Le port d’Anvers, l’un des plus actifs d’Europe, traite des marchandises pour toute l’UE.',
      de: 'Der Hafen von Antwerpen, einer der geschäftigsten Europas, wickelt Waren für die gesamte EU ab.',
    },
    'food-beverages': {
      en: 'Belgian chocolate and beer are prized exports with centuries of tradition.',
      fr: 'Le chocolat et la bière belges sont des exportations prisées, fortes de siècles de tradition.',
      de: 'Belgische Schokolade und Bier sind geschätzte Exportgüter mit jahrhundertelanger Tradition.',
    },
  },
  AT: {
    machinery: {
      en: 'Austria’s engineering firms specialise in machinery and metal products.',
      fr: 'Les entreprises d’ingénierie autrichiennes sont spécialisées dans les machines et les produits métalliques.',
      de: 'Österreichs Ingenieurunternehmen sind auf Maschinen und Metallprodukte spezialisiert.',
    },
    automotive: {
      en: 'Austria supplies engines and parts to Europe’s carmakers, notably via AVL and Magna.',
      fr: 'L’Autriche fournit moteurs et pièces aux constructeurs automobiles européens, notamment via AVL et Magna.',
      de: 'Österreich liefert Motoren und Teile an Europas Automobilhersteller, vor allem über AVL und Magna.',
    },
    tourism: {
      en: 'Alpine skiing and Vienna’s culture make tourism a mainstay of the Austrian economy.',
      fr: 'Le ski alpin et la culture viennoise font du tourisme un pilier de l’économie autrichienne.',
      de: 'Alpiner Skisport und Wiens Kultur machen den Tourismus zu einer Stütze der österreichischen Wirtschaft.',
    },
    'metals-steel': {
      en: 'Austria’s voestalpine is a leading European maker of specialty steel.',
      fr: 'L’autrichien voestalpine est un grand producteur européen d’aciers spéciaux.',
      de: 'Das österreichische Unternehmen voestalpine ist ein führender europäischer Hersteller von Spezialstahl.',
    },
  },
  PL: {
    automotive: {
      en: 'Poland has become a major hub for assembling cars and auto parts in Europe.',
      fr: 'La Pologne est devenue un grand pôle d’assemblage de voitures et de pièces automobiles en Europe.',
      de: 'Polen ist zu einem wichtigen Zentrum für die Montage von Autos und Autoteilen in Europa geworden.',
    },
    machinery: {
      en: 'Poland’s factories produce machinery and household appliances for export.',
      fr: 'Les usines polonaises produisent des machines et des appareils électroménagers destinés à l’exportation.',
      de: 'Polens Fabriken produzieren Maschinen und Haushaltsgeräte für den Export.',
    },
    agriculture: {
      en: 'Poland is one of the EU’s biggest producers of apples, poultry and grain.',
      fr: 'La Pologne est l’un des plus grands producteurs de pommes, de volaille et de céréales de l’UE.',
      de: 'Polen ist einer der größten Produzenten von Äpfeln, Geflügel und Getreide in der EU.',
    },
    'food-beverages': {
      en: 'Poland is a leading EU exporter of processed food, from meat to dairy.',
      fr: 'La Pologne est un grand exportateur de produits alimentaires transformés de l’UE, de la viande aux produits laitiers.',
      de: 'Polen ist ein führender EU-Exporteur von verarbeiteten Lebensmitteln, von Fleisch bis zu Milchprodukten.',
    },
  },
  RU: {
    'oil-gas': {
      en: 'Russia holds the world’s largest natural-gas reserves and is a top oil exporter.',
      fr: 'La Russie détient les plus grandes réserves de gaz naturel du monde et figure parmi les premiers exportateurs de pétrole.',
      de: 'Russland besitzt die größten Erdgasreserven der Welt und zählt zu den größten Ölexporteuren.',
    },
    mining: {
      en: 'Russia’s vast landmass yields nickel, palladium, diamonds and gold.',
      fr: 'L’immense territoire russe fournit nickel, palladium, diamants et or.',
      de: 'Russlands riesige Landfläche liefert Nickel, Palladium, Diamanten und Gold.',
    },
    'metals-steel': {
      en: 'Russia is one of the world’s largest producers of steel and aluminium.',
      fr: 'La Russie est l’un des plus grands producteurs d’acier et d’aluminium du monde.',
      de: 'Russland ist einer der größten Produzenten von Stahl und Aluminium weltweit.',
    },
    'aerospace-defence': {
      en: 'A Soviet legacy makes Russia a leading exporter of aircraft and weapons.',
      fr: 'L’héritage soviétique fait de la Russie un grand exportateur d’avions et d’armes.',
      de: 'Ein sowjetisches Erbe macht Russland zu einem führenden Exporteur von Flugzeugen und Waffen.',
    },
  },
  PT: {
    tourism: {
      en: 'Mild weather, beaches and cities like Lisbon and Porto make tourism vital to Portugal.',
      fr: 'Le climat doux, les plages et des villes comme Lisbonne et Porto rendent le tourisme essentiel au Portugal.',
      de: 'Mildes Wetter, Strände und Städte wie Lissabon und Porto machen den Tourismus für Portugal unverzichtbar.',
    },
    textiles: {
      en: 'Portugal has a long-standing textile and footwear industry in its northern region.',
      fr: 'Le Portugal possède une industrie textile et de la chaussure de longue date dans sa région nord.',
      de: 'Portugal verfügt in seiner nördlichen Region über eine traditionsreiche Textil- und Schuhindustrie.',
    },
    agriculture: {
      en: 'Portugal is a leading producer of cork, wine and olive oil.',
      fr: 'Le Portugal est un grand producteur de liège, de vin et d’huile d’olive.',
      de: 'Portugal ist ein führender Produzent von Kork, Wein und Olivenöl.',
    },
    'food-beverages': {
      en: 'Port wine and canned fish are traditional Portuguese food exports.',
      fr: 'Le vin de Porto et les conserves de poisson sont des exportations alimentaires traditionnelles du Portugal.',
      de: 'Portwein und Fischkonserven sind traditionelle portugiesische Lebensmittelexporte.',
    },
  },
  GR: {
    shipping: {
      en: 'Greek owners control one of the world’s largest merchant shipping fleets.',
      fr: 'Les armateurs grecs contrôlent l’une des plus grandes flottes marchandes du monde.',
      de: 'Griechische Reeder kontrollieren eine der größten Handelsflotten der Welt.',
    },
    tourism: {
      en: 'Thousands of islands and ancient ruins make tourism central to Greece’s economy.',
      fr: 'Des milliers d’îles et des ruines antiques placent le tourisme au cœur de l’économie grecque.',
      de: 'Tausende Inseln und antike Ruinen machen den Tourismus zum Herzstück der griechischen Wirtschaft.',
    },
    agriculture: {
      en: 'Greece is a major producer of olives, olive oil and feta cheese.',
      fr: 'La Grèce est un grand producteur d’olives, d’huile d’olive et de feta.',
      de: 'Griechenland ist ein bedeutender Produzent von Oliven, Olivenöl und Feta-Käse.',
    },
  },
  DK: {
    pharmaceuticals: {
      en: 'Novo Nordisk, a world leader in diabetes and obesity drugs, is Danish.',
      fr: 'Novo Nordisk, leader mondial des traitements du diabète et de l’obésité, est danois.',
      de: 'Novo Nordisk, ein Weltmarktführer bei Diabetes- und Adipositas-Medikamenten, ist dänisch.',
    },
    shipping: {
      en: 'Maersk, the world’s biggest container line for years, is based in Copenhagen.',
      fr: 'Maersk, longtemps le premier armateur de porte-conteneurs au monde, est basé à Copenhague.',
      de: 'Maersk, jahrelang die größte Containerreederei der Welt, hat seinen Sitz in Kopenhagen.',
    },
    'food-beverages': {
      en: 'Danish bacon, dairy and Carlsberg beer are long-standing food exports.',
      fr: 'Le bacon danois, les produits laitiers et la bière Carlsberg sont des exportations alimentaires de longue date.',
      de: 'Dänischer Speck, Milchprodukte und Carlsberg-Bier sind traditionsreiche Lebensmittelexporte.',
    },
    energy: {
      en: 'Denmark pioneered wind power and is home to turbine maker Vestas.',
      fr: 'Le Danemark a été un pionnier de l’énergie éolienne et abrite le fabricant de turbines Vestas.',
      de: 'Dänemark war ein Pionier der Windenergie und ist die Heimat des Turbinenherstellers Vestas.',
    },
  },

  // ── Africa ────────────────────────────────────────────────────────────────────────────
  ZA: {
    mining: {
      en: 'South Africa holds the world’s richest reserves of platinum and is a major gold producer.',
      fr: 'L’Afrique du Sud détient les plus riches réserves de platine du monde et est un grand producteur d’or.',
      de: 'Südafrika besitzt die reichsten Platinreserven der Welt und ist ein bedeutender Goldproduzent.',
    },
    automotive: {
      en: 'Global carmakers assemble vehicles in South Africa for export across the world.',
      fr: 'Des constructeurs automobiles mondiaux assemblent des véhicules en Afrique du Sud pour l’exportation dans le monde entier.',
      de: 'Globale Automobilhersteller montieren in Südafrika Fahrzeuge für den weltweiten Export.',
    },
    finance: {
      en: 'Johannesburg hosts Africa’s largest and oldest stock exchange.',
      fr: 'Johannesburg abrite la plus grande et la plus ancienne bourse d’Afrique.',
      de: 'Johannesburg beherbergt Afrikas größte und älteste Börse.',
    },
    'metals-steel': {
      en: 'South Africa’s mineral wealth feeds a substantial steel and metals industry.',
      fr: 'La richesse minérale de l’Afrique du Sud alimente une importante industrie de l’acier et des métaux.',
      de: 'Südafrikas Bodenschätze speisen eine bedeutende Stahl- und Metallindustrie.',
    },
    chemicals: {
      en: 'Sasol pioneered turning coal into fuel, anchoring a big chemicals sector.',
      fr: 'Sasol a été pionnier de la transformation du charbon en carburant, ancrant un vaste secteur chimique.',
      de: 'Sasol war Pionier bei der Umwandlung von Kohle in Kraftstoff und verankert einen großen Chemiesektor.',
    },
  },
  EG: {
    tourism: {
      en: 'The pyramids and the Nile draw millions of visitors to Egypt each year.',
      fr: 'Les pyramides et le Nil attirent des millions de visiteurs en Égypte chaque année.',
      de: 'Die Pyramiden und der Nil ziehen jedes Jahr Millionen Besucher nach Ägypten.',
    },
    textiles: {
      en: 'Egyptian cotton is prized worldwide and underpins a long-standing textile industry.',
      fr: 'Le coton égyptien est prisé dans le monde entier et soutient une industrie textile de longue date.',
      de: 'Ägyptische Baumwolle ist weltweit begehrt und stützt eine traditionsreiche Textilindustrie.',
    },
    agriculture: {
      en: 'Fertile land along the Nile makes Egypt a major grower of cotton and grain.',
      fr: 'Les terres fertiles le long du Nil font de l’Égypte un grand producteur de coton et de céréales.',
      de: 'Fruchtbares Land entlang des Nils macht Ägypten zu einem bedeutenden Anbauer von Baumwolle und Getreide.',
    },
    'oil-gas': {
      en: 'Egypt has large natural-gas fields and earns fees from oil shipped through the Suez Canal.',
      fr: 'L’Égypte possède de grands gisements de gaz et perçoit des redevances sur le pétrole transitant par le canal de Suez.',
      de: 'Ägypten verfügt über große Erdgasfelder und verdient an Gebühren für Öl, das durch den Sueskanal transportiert wird.',
    },
    chemicals: {
      en: 'Egypt produces fertilisers and petrochemicals from its natural-gas resources.',
      fr: 'L’Égypte produit des engrais et des produits pétrochimiques à partir de ses ressources en gaz naturel.',
      de: 'Ägypten produziert Düngemittel und Petrochemikalien aus seinen Erdgasressourcen.',
    },
  },
  NG: {
    'oil-gas': {
      en: 'Oil exports have long been the mainstay of Nigeria’s economy, Africa’s biggest.',
      fr: 'Les exportations de pétrole sont depuis longtemps le pilier de l’économie nigériane, la plus grande d’Afrique.',
      de: 'Ölexporte sind seit Langem die Hauptstütze der nigerianischen Wirtschaft, der größten Afrikas.',
    },
    agriculture: {
      en: 'Nigeria is a leading producer of cassava, yams and cocoa.',
      fr: 'Le Nigeria est un grand producteur de manioc, d’igname et de cacao.',
      de: 'Nigeria ist ein führender Produzent von Maniok, Yams und Kakao.',
    },
    finance: {
      en: 'Lagos is a fast-growing financial and fintech centre for West Africa.',
      fr: 'Lagos est un centre financier et de fintech à croissance rapide pour l’Afrique de l’Ouest.',
      de: 'Lagos ist ein schnell wachsendes Finanz- und Fintech-Zentrum für Westafrika.',
    },
  },
  MA: {
    tourism: {
      en: 'Marrakech, the coast and the Atlas mountains make tourism a pillar of Morocco’s economy.',
      fr: 'Marrakech, la côte et les montagnes de l’Atlas font du tourisme un pilier de l’économie marocaine.',
      de: 'Marrakesch, die Küste und das Atlasgebirge machen den Tourismus zu einer Säule der marokkanischen Wirtschaft.',
    },
    agriculture: {
      en: 'Morocco is a big exporter of citrus, tomatoes and other produce to Europe.',
      fr: 'Le Maroc est un grand exportateur d’agrumes, de tomates et d’autres produits vers l’Europe.',
      de: 'Marokko ist ein großer Exporteur von Zitrusfrüchten, Tomaten und anderen Erzeugnissen nach Europa.',
    },
    textiles: {
      en: 'Clothing factories supply European fashion brands from Moroccan cities.',
      fr: 'Des usines de confection approvisionnent les marques de mode européennes depuis les villes marocaines.',
      de: 'Bekleidungsfabriken beliefern europäische Modemarken von marokkanischen Städten aus.',
    },
    mining: {
      en: 'Morocco holds most of the world’s phosphate reserves, key for fertiliser.',
      fr: 'Le Maroc détient l’essentiel des réserves mondiales de phosphate, essentiel aux engrais.',
      de: 'Marokko besitzt den Großteil der weltweiten Phosphatreserven, die für Düngemittel entscheidend sind.',
    },
    automotive: {
      en: 'Morocco has become one of Africa’s largest car manufacturers, exporting to Europe.',
      fr: 'Le Maroc est devenu l’un des plus grands constructeurs automobiles d’Afrique, exportant vers l’Europe.',
      de: 'Marokko ist zu einem der größten Automobilhersteller Afrikas geworden und exportiert nach Europa.',
    },
  },
  KE: {
    agriculture: {
      en: 'Kenya is one of the world’s leading tea exporters and a major flower grower.',
      fr: 'Le Kenya est l’un des premiers exportateurs de thé au monde et un grand producteur de fleurs.',
      de: 'Kenia ist einer der weltweit führenden Teeexporteure und ein bedeutender Blumenproduzent.',
    },
    tourism: {
      en: 'Safaris in the Maasai Mara and coastal beaches draw visitors to Kenya.',
      fr: 'Les safaris dans le Masaï Mara et les plages côtières attirent les visiteurs au Kenya.',
      de: 'Safaris in der Massai Mara und Strände an der Küste locken Besucher nach Kenia.',
    },
    'food-beverages': {
      en: 'Kenya processes tea, coffee and dairy for domestic use and export.',
      fr: 'Le Kenya transforme thé, café et produits laitiers pour la consommation locale et l’exportation.',
      de: 'Kenia verarbeitet Tee, Kaffee und Milchprodukte für den heimischen Verbrauch und den Export.',
    },
  },
  DZ: {
    'oil-gas': {
      en: 'Oil and gas provide the vast majority of Algeria’s export earnings.',
      fr: 'Le pétrole et le gaz fournissent la grande majorité des recettes d’exportation de l’Algérie.',
      de: 'Öl und Gas liefern den Großteil der Exporteinnahmen Algeriens.',
    },
    mining: {
      en: 'Algeria mines iron ore and phosphates alongside its hydrocarbon wealth.',
      fr: 'L’Algérie exploite le minerai de fer et les phosphates en plus de sa richesse en hydrocarbures.',
      de: 'Algerien fördert neben seinem Reichtum an Kohlenwasserstoffen Eisenerz und Phosphate.',
    },
  },
  ET: {
    agriculture: {
      en: 'Ethiopia is the birthplace of coffee and Africa’s biggest coffee producer.',
      fr: 'L’Éthiopie est le berceau du café et le premier producteur de café d’Afrique.',
      de: 'Äthiopien ist die Heimat des Kaffees und Afrikas größter Kaffeeproduzent.',
    },
    textiles: {
      en: 'Ethiopia has courted global clothing brands to build a growing garment industry.',
      fr: 'L’Éthiopie a attiré des marques de vêtements mondiales pour bâtir une industrie de la confection en pleine croissance.',
      de: 'Äthiopien hat globale Bekleidungsmarken angeworben, um eine wachsende Textilindustrie aufzubauen.',
    },
    'food-beverages': {
      en: 'Coffee processing and food production are central to Ethiopia’s economy.',
      fr: 'La transformation du café et la production alimentaire sont au cœur de l’économie éthiopienne.',
      de: 'Kaffeeverarbeitung und Lebensmittelproduktion sind zentral für die äthiopische Wirtschaft.',
    },
  },

  // ── Americas ──────────────────────────────────────────────────────────────────────────
  US: {
    'it-software': {
      en: 'Silicon Valley makes the US home to the world’s largest tech companies.',
      fr: 'La Silicon Valley fait des États-Unis le berceau des plus grandes entreprises technologiques du monde.',
      de: 'Das Silicon Valley macht die USA zur Heimat der größten Technologieunternehmen der Welt.',
    },
    'aerospace-defence': {
      en: 'Boeing, Lockheed Martin and NASA make the US the world’s aerospace leader.',
      fr: 'Boeing, Lockheed Martin et la NASA font des États-Unis le leader mondial de l’aérospatiale.',
      de: 'Boeing, Lockheed Martin und die NASA machen die USA zum weltweiten Marktführer in der Luft- und Raumfahrt.',
    },
    finance: {
      en: 'Wall Street in New York is the heart of the world’s financial system.',
      fr: 'Wall Street, à New York, est le cœur du système financier mondial.',
      de: 'Die Wall Street in New York ist das Herz des weltweiten Finanzsystems.',
    },
    automotive: {
      en: 'Detroit gave rise to Ford and General Motors and mass car production.',
      fr: 'Detroit a vu naître Ford et General Motors et la production automobile de masse.',
      de: 'In Detroit entstanden Ford und General Motors sowie die Massenproduktion von Autos.',
    },
    pharmaceuticals: {
      en: 'The US hosts the world’s largest pharmaceutical industry, led by firms like Pfizer.',
      fr: 'Les États-Unis abritent la plus grande industrie pharmaceutique du monde, menée par des firmes comme Pfizer.',
      de: 'Die USA beherbergen die größte Pharmaindustrie der Welt, angeführt von Firmen wie Pfizer.',
    },
  },
  CA: {
    'oil-gas': {
      en: 'Alberta’s oil sands hold some of the world’s largest crude reserves.',
      fr: 'Les sables bitumineux de l’Alberta renferment certaines des plus grandes réserves de brut du monde.',
      de: 'Albertas Ölsande bergen einige der größten Rohölreserven der Welt.',
    },
    mining: {
      en: 'Canada is a top global producer of potash, uranium and nickel.',
      fr: 'Le Canada est l’un des premiers producteurs mondiaux de potasse, d’uranium et de nickel.',
      de: 'Kanada ist ein weltweit führender Produzent von Kali, Uran und Nickel.',
    },
    'timber-paper': {
      en: 'Vast boreal forests make Canada a leading exporter of lumber and paper.',
      fr: 'D’immenses forêts boréales font du Canada un grand exportateur de bois d’œuvre et de papier.',
      de: 'Ausgedehnte boreale Wälder machen Kanada zu einem führenden Exporteur von Bauholz und Papier.',
    },
    agriculture: {
      en: 'The Prairie provinces make Canada one of the world’s biggest wheat exporters.',
      fr: 'Les provinces des Prairies font du Canada l’un des plus grands exportateurs de blé au monde.',
      de: 'Die Prärieprovinzen machen Kanada zu einem der größten Weizenexporteure der Welt.',
    },
    automotive: {
      en: 'Ontario’s plants tie Canada’s car industry closely to the United States.',
      fr: 'Les usines de l’Ontario lient étroitement l’industrie automobile canadienne aux États-Unis.',
      de: 'Die Werke in Ontario verbinden Kanadas Autoindustrie eng mit den Vereinigten Staaten.',
    },
  },
  BR: {
    agriculture: {
      en: 'Brazil is the world’s largest exporter of coffee, sugar, soy and beef.',
      fr: 'Le Brésil est le premier exportateur mondial de café, de sucre, de soja et de bœuf.',
      de: 'Brasilien ist der weltweit größte Exporteur von Kaffee, Zucker, Soja und Rindfleisch.',
    },
    automotive: {
      en: 'Brazil is Latin America’s largest car market and producer.',
      fr: 'Le Brésil est le plus grand marché et producteur automobile d’Amérique latine.',
      de: 'Brasilien ist der größte Automarkt und -produzent Lateinamerikas.',
    },
    mining: {
      en: 'Brazil’s Vale is one of the world’s biggest iron-ore miners.',
      fr: 'Le brésilien Vale est l’un des plus grands producteurs de minerai de fer du monde.',
      de: 'Das brasilianische Unternehmen Vale ist einer der größten Eisenerzförderer der Welt.',
    },
    'aerospace-defence': {
      en: 'Embraer makes Brazil one of the world’s top three planemakers.',
      fr: 'Embraer fait du Brésil l’un des trois premiers avionneurs mondiaux.',
      de: 'Embraer macht Brasilien zu einem der drei größten Flugzeughersteller der Welt.',
    },
    'oil-gas': {
      en: 'Offshore "pre-salt" fields have made Brazil a major oil producer.',
      fr: 'Les gisements offshore « pré-sal » ont fait du Brésil un grand producteur de pétrole.',
      de: 'Offshore-„Pré-Sal“-Felder haben Brasilien zu einem bedeutenden Ölproduzenten gemacht.',
    },
  },
  MX: {
    automotive: {
      en: 'Mexico is one of the world’s largest car exporters, supplying the US market.',
      fr: 'Le Mexique est l’un des plus grands exportateurs de voitures au monde, approvisionnant le marché américain.',
      de: 'Mexiko ist einer der größten Autoexporteure der Welt und beliefert den US-Markt.',
    },
    electronics: {
      en: 'Border factories assemble TVs and electronics for North America.',
      fr: 'Des usines frontalières assemblent téléviseurs et appareils électroniques pour l’Amérique du Nord.',
      de: 'Grenzfabriken montieren Fernseher und Elektronik für Nordamerika.',
    },
    'oil-gas': {
      en: 'State oil company Pemex has long been a pillar of Mexico’s economy.',
      fr: 'La compagnie pétrolière publique Pemex est depuis longtemps un pilier de l’économie mexicaine.',
      de: 'Der staatliche Ölkonzern Pemex ist seit Langem eine Säule der mexikanischen Wirtschaft.',
    },
    agriculture: {
      en: 'Mexico is a leading exporter of avocados, tomatoes and berries.',
      fr: 'Le Mexique est un grand exportateur d’avocats, de tomates et de baies.',
      de: 'Mexiko ist ein führender Exporteur von Avocados, Tomaten und Beeren.',
    },
    tourism: {
      en: 'Beach resorts like Cancún make tourism a major earner for Mexico.',
      fr: 'Des stations balnéaires comme Cancún font du tourisme une source majeure de revenus pour le Mexique.',
      de: 'Badeorte wie Cancún machen den Tourismus zu einer wichtigen Einnahmequelle für Mexiko.',
    },
  },
  AR: {
    agriculture: {
      en: 'The Pampas make Argentina a top exporter of beef, soy and wheat.',
      fr: 'La Pampa fait de l’Argentine un grand exportateur de bœuf, de soja et de blé.',
      de: 'Die Pampa macht Argentinien zu einem Spitzenexporteur von Rindfleisch, Soja und Weizen.',
    },
    automotive: {
      en: 'Argentina has a long-established car industry centred on Córdoba.',
      fr: 'L’Argentine possède une industrie automobile de longue date centrée sur Córdoba.',
      de: 'Argentinien verfügt über eine traditionsreiche Automobilindustrie mit Zentrum in Córdoba.',
    },
    'food-beverages': {
      en: 'Argentina is famous for its beef and is a major wine producer.',
      fr: 'L’Argentine est réputée pour son bœuf et est un grand producteur de vin.',
      de: 'Argentinien ist für sein Rindfleisch berühmt und ein bedeutender Weinproduzent.',
    },
    'oil-gas': {
      en: 'The Vaca Muerta shale field holds vast oil and gas potential.',
      fr: 'Le gisement de schiste de Vaca Muerta recèle un immense potentiel pétrolier et gazier.',
      de: 'Das Schiefervorkommen Vaca Muerta birgt ein enormes Öl- und Gaspotenzial.',
    },
  },
  CL: {
    mining: {
      en: 'Chile is the world’s largest copper producer, mined in the Atacama Desert.',
      fr: 'Le Chili est le premier producteur mondial de cuivre, extrait dans le désert d’Atacama.',
      de: 'Chile ist der weltweit größte Kupferproduzent, gefördert in der Atacama-Wüste.',
    },
    agriculture: {
      en: 'Chile exports fruit and wine to the northern hemisphere during its summer.',
      fr: 'Le Chili exporte fruits et vin vers l’hémisphère nord durant son été.',
      de: 'Chile exportiert während seines Sommers Obst und Wein in die Nordhalbkugel.',
    },
    fishing: {
      en: 'Chile’s long Pacific coast makes it a leading salmon and fishmeal exporter.',
      fr: 'Sa longue côte pacifique fait du Chili un grand exportateur de saumon et de farine de poisson.',
      de: 'Seine lange Pazifikküste macht Chile zu einem führenden Exporteur von Lachs und Fischmehl.',
    },
  },
  CO: {
    'oil-gas': {
      en: 'Oil is one of Colombia’s leading exports.',
      fr: 'Le pétrole est l’une des principales exportations de la Colombie.',
      de: 'Erdöl ist eines der wichtigsten Exportgüter Kolumbiens.',
    },
    agriculture: {
      en: 'Colombian coffee and cut flowers are famous around the world.',
      fr: 'Le café colombien et les fleurs coupées sont célèbres dans le monde entier.',
      de: 'Kolumbianischer Kaffee und Schnittblumen sind weltweit berühmt.',
    },
    mining: {
      en: 'Colombia is a leading exporter of coal and emeralds.',
      fr: 'La Colombie est un grand exportateur de charbon et d’émeraudes.',
      de: 'Kolumbien ist ein führender Exporteur von Kohle und Smaragden.',
    },
  },
  PE: {
    mining: {
      en: 'Peru is a top world producer of copper, silver and zinc.',
      fr: 'Le Pérou est l’un des premiers producteurs mondiaux de cuivre, d’argent et de zinc.',
      de: 'Peru ist ein weltweit führender Produzent von Kupfer, Silber und Zink.',
    },
    fishing: {
      en: 'Cold Pacific currents make Peru a top producer of fishmeal.',
      fr: 'Les courants froids du Pacifique font du Pérou un grand producteur de farine de poisson.',
      de: 'Kalte Pazifikströmungen machen Peru zu einem führenden Produzenten von Fischmehl.',
    },
    agriculture: {
      en: 'Peru exports blueberries, avocados and asparagus around the world.',
      fr: 'Le Pérou exporte myrtilles, avocats et asperges dans le monde entier.',
      de: 'Peru exportiert Blaubeeren, Avocados und Spargel in die ganze Welt.',
    },
  },
  VE: {
    'oil-gas': {
      en: 'Venezuela holds the world’s largest proven oil reserves.',
      fr: 'Le Venezuela détient les plus grandes réserves prouvées de pétrole du monde.',
      de: 'Venezuela besitzt die größten nachgewiesenen Ölreserven der Welt.',
    },
    mining: {
      en: 'Venezuela mines gold, iron ore and bauxite in its Guayana region.',
      fr: 'Le Venezuela exploite or, minerai de fer et bauxite dans sa région de Guayana.',
      de: 'Venezuela fördert in seiner Guayana-Region Gold, Eisenerz und Bauxit.',
    },
  },
  CU: {
    tourism: {
      en: 'Havana’s heritage and Caribbean beaches make tourism vital to Cuba.',
      fr: 'Le patrimoine de La Havane et les plages des Caraïbes rendent le tourisme essentiel à Cuba.',
      de: 'Havannas Kulturerbe und karibische Strände machen den Tourismus für Kuba unverzichtbar.',
    },
    agriculture: {
      en: 'Cuba is famous for its sugar, tobacco and hand-rolled cigars.',
      fr: 'Cuba est réputée pour son sucre, son tabac et ses cigares roulés à la main.',
      de: 'Kuba ist berühmt für seinen Zucker, Tabak und handgerollten Zigarren.',
    },
    pharmaceuticals: {
      en: 'Cuba has built a notable biotech and vaccine industry.',
      fr: 'Cuba a bâti une industrie biotechnologique et vaccinale remarquable.',
      de: 'Kuba hat eine bemerkenswerte Biotech- und Impfstoffindustrie aufgebaut.',
    },
  },

  // ── Asia ──────────────────────────────────────────────────────────────────────────────
  CN: {
    electronics: {
      en: 'China assembles most of the world’s smartphones and consumer electronics.',
      fr: 'La Chine assemble la majeure partie des smartphones et de l’électronique grand public du monde.',
      de: 'China montiert den Großteil der Smartphones und Unterhaltungselektronik der Welt.',
    },
    machinery: {
      en: 'China is the world’s largest manufacturer of machinery and equipment.',
      fr: 'La Chine est le premier fabricant mondial de machines et d’équipements.',
      de: 'China ist der weltweit größte Hersteller von Maschinen und Ausrüstung.',
    },
    textiles: {
      en: 'China is the world’s biggest producer and exporter of textiles and clothing.',
      fr: 'La Chine est le premier producteur et exportateur mondial de textiles et de vêtements.',
      de: 'China ist der weltweit größte Produzent und Exporteur von Textilien und Kleidung.',
    },
    'metals-steel': {
      en: 'China produces more than half of the world’s steel.',
      fr: 'La Chine produit plus de la moitié de l’acier mondial.',
      de: 'China produziert mehr als die Hälfte des weltweiten Stahls.',
    },
    automotive: {
      en: 'China is the world’s largest car market and a fast-rising EV exporter.',
      fr: 'La Chine est le plus grand marché automobile du monde et un exportateur de véhicules électriques en plein essor.',
      de: 'China ist der größte Automarkt der Welt und ein rasch aufsteigender E-Auto-Exporteur.',
    },
    chemicals: {
      en: 'China is the world’s largest chemical producer by output.',
      fr: 'La Chine est le premier producteur mondial de produits chimiques en volume.',
      de: 'China ist gemessen an der Produktion der weltweit größte Chemieproduzent.',
    },
  },
  JP: {
    automotive: {
      en: 'Toyota and Honda make Japan a global powerhouse in carmaking.',
      fr: 'Toyota et Honda font du Japon une puissance mondiale de l’automobile.',
      de: 'Toyota und Honda machen Japan zu einer globalen Größe im Automobilbau.',
    },
    electronics: {
      en: 'Sony, Panasonic and Nintendo built Japan’s world-famous electronics industry.',
      fr: 'Sony, Panasonic et Nintendo ont bâti l’industrie électronique mondialement célèbre du Japon.',
      de: 'Sony, Panasonic und Nintendo bauten Japans weltberühmte Elektronikindustrie auf.',
    },
    machinery: {
      en: 'Japan leads the world in industrial robots and precision machinery.',
      fr: 'Le Japon est le leader mondial des robots industriels et des machines de précision.',
      de: 'Japan ist weltweit führend bei Industrierobotern und Präzisionsmaschinen.',
    },
    'metals-steel': {
      en: 'Japan is one of the world’s largest and most advanced steel producers.',
      fr: 'Le Japon est l’un des producteurs d’acier les plus grands et avancés du monde.',
      de: 'Japan ist einer der größten und fortschrittlichsten Stahlproduzenten der Welt.',
    },
  },
  IN: {
    'it-software': {
      en: 'Bengaluru is India’s Silicon Valley, hub of a huge IT-services industry.',
      fr: 'Bangalore est la Silicon Valley de l’Inde, cœur d’une immense industrie de services informatiques.',
      de: 'Bengaluru ist Indiens Silicon Valley, das Zentrum einer riesigen IT-Dienstleistungsbranche.',
    },
    textiles: {
      en: 'India is one of the world’s largest producers of cotton and textiles.',
      fr: 'L’Inde est l’un des plus grands producteurs de coton et de textiles au monde.',
      de: 'Indien ist einer der größten Produzenten von Baumwolle und Textilien weltweit.',
    },
    pharmaceuticals: {
      en: 'India is called the "pharmacy of the world" for its generic-drug output.',
      fr: 'L’Inde est surnommée la « pharmacie du monde » pour sa production de médicaments génériques.',
      de: 'Indien wird für seine Generikaproduktion als „Apotheke der Welt“ bezeichnet.',
    },
    agriculture: {
      en: 'India is a top world producer of rice, wheat, milk and spices.',
      fr: 'L’Inde est l’un des premiers producteurs mondiaux de riz, de blé, de lait et d’épices.',
      de: 'Indien ist ein weltweit führender Produzent von Reis, Weizen, Milch und Gewürzen.',
    },
    automotive: {
      en: 'India is a leading maker of motorcycles and small cars.',
      fr: 'L’Inde est un grand fabricant de motos et de petites voitures.',
      de: 'Indien ist ein führender Hersteller von Motorrädern und Kleinwagen.',
    },
  },
  KR: {
    electronics: {
      en: 'Samsung and SK Hynix make South Korea a leader in chips and smartphones.',
      fr: 'Samsung et SK Hynix font de la Corée du Sud un leader des puces et des smartphones.',
      de: 'Samsung und SK Hynix machen Südkorea zu einem führenden Anbieter von Chips und Smartphones.',
    },
    automotive: {
      en: 'Hyundai and Kia rank among the world’s biggest carmakers.',
      fr: 'Hyundai et Kia figurent parmi les plus grands constructeurs automobiles du monde.',
      de: 'Hyundai und Kia zählen zu den größten Automobilherstellern der Welt.',
    },
    shipping: {
      en: 'South Korean yards build a large share of the world’s ships.',
      fr: 'Les chantiers sud-coréens construisent une grande part des navires du monde.',
      de: 'Südkoreanische Werften bauen einen großen Teil der Schiffe der Welt.',
    },
    'metals-steel': {
      en: 'POSCO makes South Korea a major global steel producer.',
      fr: 'POSCO fait de la Corée du Sud un grand producteur mondial d’acier.',
      de: 'POSCO macht Südkorea zu einem bedeutenden globalen Stahlproduzenten.',
    },
    chemicals: {
      en: 'South Korea has a large petrochemical industry serving its manufacturers.',
      fr: 'La Corée du Sud possède une vaste industrie pétrochimique au service de ses fabricants.',
      de: 'Südkorea verfügt über eine große petrochemische Industrie, die seine Hersteller versorgt.',
    },
  },
  SA: {
    'oil-gas': {
      en: 'Saudi Aramco pumps from the world’s largest crude reserves.',
      fr: 'Saudi Aramco puise dans les plus grandes réserves de brut du monde.',
      de: 'Saudi Aramco fördert aus den größten Rohölreserven der Welt.',
    },
    chemicals: {
      en: 'Cheap oil feeds SABIC, one of the world’s biggest petrochemical firms.',
      fr: 'Le pétrole bon marché alimente SABIC, l’une des plus grandes entreprises pétrochimiques du monde.',
      de: 'Billiges Öl versorgt SABIC, eines der größten Petrochemieunternehmen der Welt.',
    },
    'construction-materials': {
      en: 'Vast building projects drive Saudi demand for cement and steel.',
      fr: 'D’immenses projets de construction stimulent la demande saoudienne de ciment et d’acier.',
      de: 'Riesige Bauprojekte treiben die saudische Nachfrage nach Zement und Stahl an.',
    },
  },
  AE: {
    'oil-gas': {
      en: 'Oil and gas funded the UAE’s transformation and much of its government revenue.',
      fr: 'Le pétrole et le gaz ont financé la transformation des Émirats et une grande partie de leurs recettes publiques.',
      de: 'Öl und Gas finanzierten den Wandel der VAE und einen Großteil ihrer Staatseinnahmen.',
    },
    finance: {
      en: 'Dubai has grown into the Middle East’s leading financial centre.',
      fr: 'Dubaï est devenue le premier centre financier du Moyen-Orient.',
      de: 'Dubai hat sich zum führenden Finanzzentrum des Nahen Ostens entwickelt.',
    },
    tourism: {
      en: 'Dubai’s skyscrapers and shopping draw tens of millions of tourists a year.',
      fr: 'Les gratte-ciel et les commerces de Dubaï attirent des dizaines de millions de touristes par an.',
      de: 'Dubais Wolkenkratzer und Einkaufsmöglichkeiten ziehen jährlich Dutzende Millionen Touristen an.',
    },
    'construction-materials': {
      en: 'A relentless building boom drives the UAE’s construction-materials industry.',
      fr: 'Un boom immobilier incessant alimente l’industrie des matériaux de construction des Émirats.',
      de: 'Ein anhaltender Bauboom treibt die Baustoffindustrie der VAE an.',
    },
  },
  IL: {
    'it-software': {
      en: 'Israel is nicknamed the "Start-up Nation" for its dense tech sector.',
      fr: 'Israël est surnommé la « nation start-up » pour la densité de son secteur technologique.',
      de: 'Israel wird für seinen dichten Techsektor als „Start-up-Nation“ bezeichnet.',
    },
    'aerospace-defence': {
      en: 'Israel is a leading exporter of drones, missiles and defence technology.',
      fr: 'Israël est un grand exportateur de drones, de missiles et de technologies de défense.',
      de: 'Israel ist ein führender Exporteur von Drohnen, Raketen und Verteidigungstechnologie.',
    },
    electronics: {
      en: 'Global chipmakers run major research and fabrication sites in Israel.',
      fr: 'Les fabricants de puces mondiaux exploitent d’importants sites de recherche et de production en Israël.',
      de: 'Globale Chiphersteller betreiben in Israel bedeutende Forschungs- und Fertigungsstandorte.',
    },
    pharmaceuticals: {
      en: 'Teva, the world’s largest generic-drug maker, is Israeli.',
      fr: 'Teva, premier fabricant mondial de médicaments génériques, est israélien.',
      de: 'Teva, der weltgrößte Generikahersteller, ist israelisch.',
    },
  },
  TR: {
    automotive: {
      en: 'Turkey is a major car and vehicle producer supplying Europe.',
      fr: 'La Turquie est un grand producteur de voitures et de véhicules approvisionnant l’Europe.',
      de: 'Die Türkei ist ein bedeutender Auto- und Fahrzeugproduzent, der Europa beliefert.',
    },
    textiles: {
      en: 'Turkey is one of Europe’s biggest suppliers of clothing and textiles.',
      fr: 'La Turquie est l’un des plus grands fournisseurs de vêtements et de textiles d’Europe.',
      de: 'Die Türkei ist einer der größten Bekleidungs- und Textillieferanten Europas.',
    },
    tourism: {
      en: 'Istanbul and the coast make Turkey one of the world’s most-visited countries.',
      fr: 'Istanbul et le littoral font de la Turquie l’un des pays les plus visités au monde.',
      de: 'Istanbul und die Küste machen die Türkei zu einem der meistbesuchten Länder der Welt.',
    },
    machinery: {
      en: 'Turkey manufactures a wide range of machinery and appliances for export.',
      fr: 'La Turquie fabrique une large gamme de machines et d’appareils destinés à l’exportation.',
      de: 'Die Türkei stellt eine breite Palette von Maschinen und Geräten für den Export her.',
    },
    'construction-materials': {
      en: 'Turkish contractors and cement makers work across the region.',
      fr: 'Les entrepreneurs et cimentiers turcs opèrent dans toute la région.',
      de: 'Türkische Bauunternehmen und Zementhersteller sind in der gesamten Region tätig.',
    },
  },
  ID: {
    'oil-gas': {
      en: 'Indonesia is a major exporter of natural gas and, historically, oil.',
      fr: 'L’Indonésie est un grand exportateur de gaz naturel et, historiquement, de pétrole.',
      de: 'Indonesien ist ein bedeutender Exporteur von Erdgas und, historisch, von Erdöl.',
    },
    mining: {
      en: 'Indonesia is the world’s biggest producer of nickel and a major coal exporter.',
      fr: 'L’Indonésie est le premier producteur mondial de nickel et un grand exportateur de charbon.',
      de: 'Indonesien ist der weltgrößte Nickelproduzent und ein bedeutender Kohleexporteur.',
    },
    agriculture: {
      en: 'Indonesia is the world’s largest producer of palm oil.',
      fr: 'L’Indonésie est le premier producteur mondial d’huile de palme.',
      de: 'Indonesien ist der weltweit größte Produzent von Palmöl.',
    },
    textiles: {
      en: 'Indonesia has a large garment industry supplying global brands.',
      fr: 'L’Indonésie possède une vaste industrie de la confection approvisionnant les marques mondiales.',
      de: 'Indonesien verfügt über eine große Textilindustrie, die globale Marken beliefert.',
    },
  },
  TH: {
    automotive: {
      en: 'Thailand, the "Detroit of Asia", is a top car-assembly hub.',
      fr: 'La Thaïlande, « Detroit de l’Asie », est un grand pôle d’assemblage automobile.',
      de: 'Thailand, das „Detroit Asiens“, ist ein führendes Zentrum der Automontage.',
    },
    electronics: {
      en: 'Thailand is a major maker of hard drives and electronic components.',
      fr: 'La Thaïlande est un grand fabricant de disques durs et de composants électroniques.',
      de: 'Thailand ist ein bedeutender Hersteller von Festplatten und elektronischen Bauteilen.',
    },
    tourism: {
      en: 'Beaches and temples make tourism a mainstay of Thailand’s economy.',
      fr: 'Les plages et les temples font du tourisme un pilier de l’économie thaïlandaise.',
      de: 'Strände und Tempel machen den Tourismus zu einer Stütze der thailändischen Wirtschaft.',
    },
    agriculture: {
      en: 'Thailand is one of the world’s largest exporters of rice and rubber.',
      fr: 'La Thaïlande est l’un des plus grands exportateurs de riz et de caoutchouc au monde.',
      de: 'Thailand ist einer der größten Exporteure von Reis und Kautschuk weltweit.',
    },
  },
  SG: {
    finance: {
      en: 'Singapore is one of Asia’s leading financial and banking centres.',
      fr: 'Singapour est l’un des principaux centres financiers et bancaires d’Asie.',
      de: 'Singapur ist eines der führenden Finanz- und Bankenzentren Asiens.',
    },
    electronics: {
      en: 'Singapore is a key hub for semiconductor manufacturing and research.',
      fr: 'Singapour est une plaque tournante de la fabrication de semi-conducteurs et de la recherche.',
      de: 'Singapur ist ein wichtiges Zentrum für Halbleiterfertigung und Forschung.',
    },
    shipping: {
      en: 'Singapore’s port is one of the world’s busiest transshipment hubs.',
      fr: 'Le port de Singapour est l’une des plaques tournantes de transbordement les plus actives du monde.',
      de: 'Singapurs Hafen ist eines der geschäftigsten Umschlagzentren der Welt.',
    },
    chemicals: {
      en: 'Jurong Island concentrates a world-scale petrochemical industry.',
      fr: 'L’île de Jurong concentre une industrie pétrochimique d’envergure mondiale.',
      de: 'Die Insel Jurong konzentriert eine petrochemische Industrie von Weltrang.',
    },
    pharmaceuticals: {
      en: 'Global drugmakers run major production plants in Singapore.',
      fr: 'Les laboratoires mondiaux exploitent d’importantes usines de production à Singapour.',
      de: 'Globale Arzneimittelhersteller betreiben in Singapur bedeutende Produktionsanlagen.',
    },
  },
  VN: {
    electronics: {
      en: 'Vietnam has become a major assembly base for phones and electronics.',
      fr: 'Le Vietnam est devenu une grande base d’assemblage de téléphones et d’électronique.',
      de: 'Vietnam ist zu einer wichtigen Montagebasis für Telefone und Elektronik geworden.',
    },
    textiles: {
      en: 'Vietnam is one of the world’s largest clothing and footwear exporters.',
      fr: 'Le Vietnam est l’un des plus grands exportateurs de vêtements et de chaussures au monde.',
      de: 'Vietnam ist einer der größten Bekleidungs- und Schuhexporteure der Welt.',
    },
    agriculture: {
      en: 'Vietnam is a top exporter of rice, coffee and cashews.',
      fr: 'Le Vietnam est un grand exportateur de riz, de café et de noix de cajou.',
      de: 'Vietnam ist ein führender Exporteur von Reis, Kaffee und Cashewnüssen.',
    },
    'food-beverages': {
      en: 'Vietnam processes seafood, coffee and rice for export worldwide.',
      fr: 'Le Vietnam transforme produits de la mer, café et riz pour l’exportation mondiale.',
      de: 'Vietnam verarbeitet Meeresfrüchte, Kaffee und Reis für den weltweiten Export.',
    },
  },
  MY: {
    electronics: {
      en: 'Malaysia is a long-standing hub for chip assembly and testing.',
      fr: 'La Malaisie est depuis longtemps une plaque tournante de l’assemblage et du test de puces.',
      de: 'Malaysia ist seit Langem ein Zentrum für Chip-Montage und -Prüfung.',
    },
    'oil-gas': {
      en: 'State firm Petronas makes oil and gas central to Malaysia’s economy.',
      fr: 'La compagnie publique Petronas place le pétrole et le gaz au cœur de l’économie malaisienne.',
      de: 'Der Staatskonzern Petronas macht Öl und Gas zum Kern der malaysischen Wirtschaft.',
    },
    agriculture: {
      en: 'Malaysia is one of the world’s largest palm-oil producers.',
      fr: 'La Malaisie est l’un des plus grands producteurs d’huile de palme au monde.',
      de: 'Malaysia ist einer der größten Palmölproduzenten der Welt.',
    },
    tourism: {
      en: 'Kuala Lumpur and tropical islands draw many visitors to Malaysia.',
      fr: 'Kuala Lumpur et les îles tropicales attirent de nombreux visiteurs en Malaisie.',
      de: 'Kuala Lumpur und tropische Inseln locken viele Besucher nach Malaysia.',
    },
  },
  IR: {
    'oil-gas': {
      en: 'Iran holds some of the world’s largest oil and gas reserves.',
      fr: 'L’Iran détient certaines des plus grandes réserves de pétrole et de gaz du monde.',
      de: 'Der Iran besitzt einige der größten Öl- und Gasreserven der Welt.',
    },
    agriculture: {
      en: 'Iran is a leading grower of pistachios, saffron and dates.',
      fr: 'L’Iran est un grand producteur de pistaches, de safran et de dattes.',
      de: 'Der Iran ist ein führender Anbauer von Pistazien, Safran und Datteln.',
    },
    automotive: {
      en: 'Iran has the Middle East’s largest car-manufacturing industry.',
      fr: 'L’Iran possède la plus grande industrie automobile du Moyen-Orient.',
      de: 'Der Iran verfügt über die größte Automobilindustrie des Nahen Ostens.',
    },
  },
  IQ: {
    'oil-gas': {
      en: 'Oil provides nearly all of Iraq’s export revenue.',
      fr: 'Le pétrole fournit la quasi-totalité des recettes d’exportation de l’Irak.',
      de: 'Erdöl liefert nahezu die gesamten Exporteinnahmen des Irak.',
    },
  },
  KW: {
    'oil-gas': {
      en: 'Oil accounts for the vast majority of Kuwait’s wealth and exports.',
      fr: 'Le pétrole représente la grande majorité de la richesse et des exportations du Koweït.',
      de: 'Erdöl macht den Großteil des Reichtums und der Exporte Kuwaits aus.',
    },
  },
  QA: {
    'oil-gas': {
      en: 'Qatar is one of the world’s largest exporters of liquefied natural gas.',
      fr: 'Le Qatar est l’un des plus grands exportateurs de gaz naturel liquéfié au monde.',
      de: 'Katar ist einer der größten Exporteure von verflüssigtem Erdgas weltweit.',
    },
    finance: {
      en: 'Gas wealth has turned Doha into a growing financial centre.',
      fr: 'La richesse gazière a fait de Doha un centre financier en pleine croissance.',
      de: 'Der Gasreichtum hat Doha zu einem wachsenden Finanzzentrum gemacht.',
    },
    'construction-materials': {
      en: 'Preparing for the 2022 World Cup drove a huge construction boom.',
      fr: 'La préparation de la Coupe du monde 2022 a entraîné un énorme boom de la construction.',
      de: 'Die Vorbereitung auf die WM 2022 löste einen enormen Bauboom aus.',
    },
  },
  PK: {
    textiles: {
      en: 'Cotton makes textiles Pakistan’s biggest industry and export.',
      fr: 'Le coton fait du textile la plus grande industrie et exportation du Pakistan.',
      de: 'Baumwolle macht Textilien zu Pakistans größter Industrie und Exportgut.',
    },
    agriculture: {
      en: 'Pakistan is a major producer of cotton, wheat and rice.',
      fr: 'Le Pakistan est un grand producteur de coton, de blé et de riz.',
      de: 'Pakistan ist ein bedeutender Produzent von Baumwolle, Weizen und Reis.',
    },
    pharmaceuticals: {
      en: 'Pakistan has a sizeable industry making medicines for its large population.',
      fr: 'Le Pakistan possède une industrie importante produisant des médicaments pour sa nombreuse population.',
      de: 'Pakistan verfügt über eine beachtliche Industrie, die Medikamente für seine große Bevölkerung herstellt.',
    },
  },
  BD: {
    textiles: {
      en: 'Bangladesh is the world’s second-largest garment exporter after China.',
      fr: 'Le Bangladesh est le deuxième exportateur mondial de vêtements après la Chine.',
      de: 'Bangladesch ist nach China der zweitgrößte Bekleidungsexporteur der Welt.',
    },
    agriculture: {
      en: 'Bangladesh is among the world’s top rice and jute producers.',
      fr: 'Le Bangladesh figure parmi les premiers producteurs mondiaux de riz et de jute.',
      de: 'Bangladesch gehört zu den weltweit größten Reis- und Juteproduzenten.',
    },
    pharmaceuticals: {
      en: 'Bangladesh makes most of its own medicines and exports generics.',
      fr: 'Le Bangladesh fabrique la plupart de ses propres médicaments et exporte des génériques.',
      de: 'Bangladesch stellt die meisten seiner eigenen Medikamente her und exportiert Generika.',
    },
  },
  PH: {
    electronics: {
      en: 'Electronics and chip assembly are the Philippines’ top export.',
      fr: 'L’électronique et l’assemblage de puces constituent la première exportation des Philippines.',
      de: 'Elektronik und Chip-Montage sind das wichtigste Exportgut der Philippinen.',
    },
    'it-software': {
      en: 'The Philippines is a world leader in business-process outsourcing.',
      fr: 'Les Philippines sont un leader mondial de l’externalisation des processus d’affaires.',
      de: 'Die Philippinen sind weltweit führend im Business-Process-Outsourcing.',
    },
    agriculture: {
      en: 'The Philippines is a major producer of coconuts, bananas and pineapples.',
      fr: 'Les Philippines sont un grand producteur de noix de coco, de bananes et d’ananas.',
      de: 'Die Philippinen sind ein bedeutender Produzent von Kokosnüssen, Bananen und Ananas.',
    },
    shipping: {
      en: 'Filipinos crew a large share of the world’s merchant ships.',
      fr: 'Les Philippins arment une grande part des navires marchands du monde.',
      de: 'Filipinos bemannen einen großen Teil der Handelsschiffe der Welt.',
    },
  },
  KZ: {
    'oil-gas': {
      en: 'Oil from giant Caspian fields dominates Kazakhstan’s exports.',
      fr: 'Le pétrole des gisements géants de la Caspienne domine les exportations du Kazakhstan.',
      de: 'Öl aus riesigen kaspischen Feldern dominiert die Exporte Kasachstans.',
    },
    mining: {
      en: 'Kazakhstan is one of the world’s largest uranium producers.',
      fr: 'Le Kazakhstan est l’un des plus grands producteurs d’uranium au monde.',
      de: 'Kasachstan ist einer der größten Uranproduzenten der Welt.',
    },
    agriculture: {
      en: 'Vast steppe makes Kazakhstan a significant wheat exporter.',
      fr: 'Ses vastes steppes font du Kazakhstan un exportateur de blé important.',
      de: 'Weite Steppen machen Kasachstan zu einem bedeutenden Weizenexporteur.',
    },
  },
  LK: {
    textiles: {
      en: 'Garment manufacturing is Sri Lanka’s largest export industry.',
      fr: 'La confection de vêtements est la première industrie d’exportation du Sri Lanka.',
      de: 'Die Bekleidungsherstellung ist Sri Lankas größte Exportindustrie.',
    },
    agriculture: {
      en: 'Ceylon tea is Sri Lanka’s most famous agricultural export.',
      fr: 'Le thé de Ceylan est l’exportation agricole la plus célèbre du Sri Lanka.',
      de: 'Ceylon-Tee ist Sri Lankas berühmtestes Agrarexportgut.',
    },
    tourism: {
      en: 'Beaches, wildlife and ancient sites make tourism important to Sri Lanka.',
      fr: 'Les plages, la faune et les sites antiques rendent le tourisme important pour le Sri Lanka.',
      de: 'Strände, Tierwelt und antike Stätten machen den Tourismus für Sri Lanka wichtig.',
    },
  },

  // ── Oceania ───────────────────────────────────────────────────────────────────────────
  AU: {
    mining: {
      en: 'Australia is the world’s biggest exporter of iron ore and coal.',
      fr: 'L’Australie est le premier exportateur mondial de minerai de fer et de charbon.',
      de: 'Australien ist der weltweit größte Exporteur von Eisenerz und Kohle.',
    },
    agriculture: {
      en: 'Australia is a leading exporter of wheat, beef and wool.',
      fr: 'L’Australie est un grand exportateur de blé, de bœuf et de laine.',
      de: 'Australien ist ein führender Exporteur von Weizen, Rindfleisch und Wolle.',
    },
    'oil-gas': {
      en: 'Australia has become one of the world’s top LNG exporters.',
      fr: 'L’Australie est devenue l’un des premiers exportateurs de GNL au monde.',
      de: 'Australien ist zu einem der größten LNG-Exporteure der Welt geworden.',
    },
    finance: {
      en: 'Sydney is a major financial hub for the Asia-Pacific region.',
      fr: 'Sydney est une grande place financière de la région Asie-Pacifique.',
      de: 'Sydney ist ein bedeutender Finanzplatz der Asien-Pazifik-Region.',
    },
    tourism: {
      en: 'The Great Barrier Reef and Uluru draw travellers from around the world.',
      fr: 'La Grande Barrière de corail et Uluru attirent des voyageurs du monde entier.',
      de: 'Das Great Barrier Reef und der Uluru ziehen Reisende aus aller Welt an.',
    },
  },
  NZ: {
    agriculture: {
      en: 'New Zealand is the world’s largest exporter of dairy and a major sheep farmer.',
      fr: 'La Nouvelle-Zélande est le premier exportateur mondial de produits laitiers et un grand éleveur de moutons.',
      de: 'Neuseeland ist der weltweit größte Exporteur von Milchprodukten und ein bedeutender Schafzüchter.',
    },
    'food-beverages': {
      en: 'Dairy, lamb and wine are New Zealand’s signature food exports.',
      fr: 'Les produits laitiers, l’agneau et le vin sont les exportations alimentaires emblématiques de la Nouvelle-Zélande.',
      de: 'Milchprodukte, Lamm und Wein sind Neuseelands charakteristische Lebensmittelexporte.',
    },
    tourism: {
      en: 'Dramatic landscapes, famous from film, make tourism a top earner.',
      fr: 'Des paysages spectaculaires, rendus célèbres par le cinéma, font du tourisme une source majeure de revenus.',
      de: 'Spektakuläre Landschaften, aus Filmen bekannt, machen den Tourismus zu einer wichtigen Einnahmequelle.',
    },
  },
};
