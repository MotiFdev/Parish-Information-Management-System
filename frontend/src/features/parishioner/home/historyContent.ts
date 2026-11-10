// Parish history supplied by the client (Cebuano). Text is kept as written;
// only the grouping by year and by heading is ours.

export interface HistoryPeriod {
  label: string
  paragraphs: string[]
}

export interface CarmelGroup {
  title: string
  items: Array<{ term: string; text: string[] }>
}

export const shjpHistory: HistoryPeriod[] = [
  {
    label: '1957',
    paragraphs: [
      'Niadtong tuig namugna ang kapilya sa San Francisco ug dinhi gibalhin ang sentro sa Gibong district. Usa ka misyonero gikan sa pamilya Sagrado Corazon nga mao si Fr. German Maalman ang nagdumala niini ug gikan sa ngalan sa maong grupo. Namugna ang Parokya sa Mahal nga Kasingkasing ni Hesus niadtong tuig 1957 diin si Fr. German Maalman maoy nahimo nga kura paruko niini. Gitukod ang mga tulungha-an nga sekondarya dinhi sa San Francisco ug Prosperidad ug iya kini nga ginganlan ug Urios pasidungog sa Heswita nga misyonero nga si Fr. Saturnino Urios Caytar. Niining tuiga usab miabot ang mga relihiyosong karmelita kuyog kanila mao ang usa ka pari gikan sa diyoses nga mao si Fr. Jose Falcon.',
    ],
  },
  {
    label: '1963',
    paragraphs: [
      'Abril 16, 1963 pormal nga mipuli ang mga kapari-an nga Karmelita sa pagdumala sa parokya, kauban usab ang mga kasikbit nga mga kapilya sa Rosario ug Prosperidad. Nagpadayon ang mga kalihokan sama sa inadlaw nga misa, pagkompisal, bunyag, kasal, pagbendita, pagbisita sa kabaryohan sa panahon sa piyesta, pagtukod sa Junior and Senior Legion of Mary apostleship of Mary, first communion ug pagdumala usab sa tulunghaan.',
      'Tungod niini na mao nga konsepto, nakadasig kini sa panglantaw ug programa sa atong parokya. Mitumaw ang nagkalain-lain nga matang sa katilingbanon nga pagpangalagad sama sa pag-organisa sa mga mag-uuma, mamumu-o, kabatan-onan, pagtukod ug mga credit union, kooperatiba, katekisis.',
    ],
  },
  {
    label: '1980 to 1990',
    paragraphs: [
      'Sa tuig 1980, bisan pa man sa kalisod sa sitwasyon sa kahusay ug kalinaw nagapadayon gihapon ang mga programa sa parokya. Gani nadugangan ang mga kalam-boan sama sa Peasant, Cathechitics, Health, Labor, Tribal Filipinos, Justice and Peace ug Youth Program. Tuig 1987, dugang lumilihok ang nadugang sa atong parokya ang mga kamadrehan nga Franseskana. Mihatag sila sa pag-abag labi na gayod sa tulungha-an sa katilingban. Mihinay-hinay paglambo pagbalik ang programa ug tungod ni-ini daghan nga mga kapilya ang natukod. Milanat kining mao nga sitwasyon sa mga kutay sa katu-igan hangtud sa tuig 1990.',
    ],
  },
  {
    label: '1991',
    paragraphs: [
      'Mi-abot ang tuig 1991, gilunsad ang strateheya pastoral nga anaa makabase sa BCC-CO, Basic Christian Community, Community Organizing kon GKK Gagmay’ng Kristohanon nga Katilingban. Base gayod sa linya sa Vatikano Dos, PCP 2. VMG sa Parokya nga Karmelitas.',
    ],
  },
]

export const carmelIntro =
  'Ang Our Lady of Mount Carmel maoy nag-unang Patron ug espirituhanong inahan sa order sa Carmelites diin nanukad sa mga ermitanyo nga nagpuyo sa bukid sa Carmel, sa yutang balaan sa ika 12 nga siglo.'

export const carmelGroups: CarmelGroup[] = [
  {
    title: 'Origin on Mount Carmel',
    items: [
      {
        term: 'The Prophet Elijah',
        text: [
          'Ang unang mga ermitanyo si San Elias ang nahimong modelo sa daang testamento diin nagpuyo diha sa pagkamaampoon sa bukid sa Carmel sa amihanang bahin sa Israel.',
        ],
      },
      {
        term: 'The First Chapel',
        text: [
          'Sa ika 12 ka siglo, ang mga ermitanyong Kristyano nagtukod og gagmay’ng kapilya sa bukid nga ilang gipahinungod sa bulahan nga Birhen Maria nga ilang gitawag nga “Lady of the place” (babae sa maong dapit)',
        ],
      },
    ],
  },
  {
    title: 'Rule & Move to Europe',
    items: [
      {
        term: 'The Rule of St. Albert',
        text: [
          'Tungatunga sa siglo 1206 ug 1214, Albert Avogadro ang patriarka sa Jerusalem pormal nga nagsulat og lagda “Formula of life“ (lagda sa mga ermitanyo)',
        ],
      },
      {
        term: 'Approval',
        text: ['Ang maong lagda opesyal nga giaproban ni Pope Innocent IV isip opesyal nga gambalay niadtong 1247.'],
      },
    ],
  },
  {
    title: 'Move to Europe and the Brown Scapular',
    items: [
      {
        term: 'Migration',
        text: [
          'Tungod sa nagkagrabe nga kagubot sa balaang yuta (Holy Land) panahon sa ika 13 ka siglo, ang mga ermitanyo namiya sa Mount Carmel ug mibalik sa Europe sa tungatunga sa ika 13 ka siglo og nahimong makikilimos (mindicant), sama sa orden sa Dominicans ug Franciscans.',
        ],
      },
      {
        term: 'Branches',
        text: [
          'Adunay dakung reporma nga nahitabo sa ika 15 ug ika 16 ka seglo nga gipangulohan nila Sta. Teresa de Avila ug St. John of the Cross nga hinungdan sa pagkabulag sa Calced Carmelites (ancient observance) ug sa discalced Carmelites.',
        ],
      },
    ],
  },
  {
    title: 'The Brown Scapular',
    items: [
      {
        term: 'St. Simon Stock',
        text: [
          'Pinasikad sa tradisyon kini nag-asoy nga niadtong July 16, 1251, ang Birhen Maria nagpakita sa English man nga unang prior general sa Carmelitas nga mao si St. Stock.',
        ],
      },
      {
        term: 'The Promise',
        text: [
          'Ang Birhen Maria nagpresentar kaniya sa Brown Scapular ug misaad nga si bisan kinsa nga mamatay nga nagsul-ob inubanan sa pagdebosyon maluwas gikan sa kalayo nga walay pagkapalong.',
        ],
      },
      {
        term: 'Feast Day (Kapistahan)',
        text: [
          'Ang liturikanhong pyesta sa Our Lady of Mount Carmel gisaulog sa tibuok simbahan sa tibuok kalibutan matag July 16. Gidugang kini ni Pope Benidect XIII sa Universal nga Calendaryo sa Simbahan.',
        ],
      },
    ],
  },
]
