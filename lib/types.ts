// TypeScript interfaces for the Bowman Prospect App

export interface Listing {
    itemId: string;
    title: string;
    itemWebUrl: string;
    itemEndDate: string;
    currentBidPrice?: {
        value: string;
        currency: string;
    };
    bidCount?: number;
    seller?: {
        username: string;
    };
    // Parsed data
    playerName?: string;
    hobbyRanking?: number;
    releaseYear?: number;
    baseColor?: string;
    variation?: string;
    serialNumber?: string;
    serialDenominator?: number;
}

export interface Comp {
    title: string;
    url: string;
    salePrice: number;
    saleDate: string;
    saleType: string;
}

export interface PlayerStats {
    currentLevel: string | null;
    stats: Record<string, string>;
    position: string | null;
    isPitcher: boolean;
    age?: number;
    mlbId?: number;  // For headshot URL
}

export interface ListingWithData extends Listing {
    comps: Comp[];
    playerStats: PlayerStats | null;
    avgCompPrice?: number;
    compCount?: number;
}

// Top 200 prospects list - used for filtering and ranking display
export const TOP_200_PLAYERS: string[] = [
    "konnor griffin", "leo de vries", "sebastian walcott", "kevin mcgonigle", "jesus made",
    "edward florentino", "max clark", "colt emerson", "eduardo quintero", "luis pena",
    "walker jenkins", "rainiel rodriguez", "lazaro montes", "josue de paula", "jett williams",
    "jj wetherholt", "josue briceno", "aidan miller", "zyhir hope", "michael arroyo",
    "carson benge", "caleb bonemer", "bryce rainer", "alfredo duno", "ryan clifford",
    "ralphy velazquez", "juneiker caceres", "eli willits", "mike sirota", "emmanuel rodriguez",
    "arjun nimmala", "cooper pratt", "dax kilby", "hector rodriguez", "theo gillen",
    "kaelen culpepper", "emil morales", "ryan waldschmidt", "travis bazzana", "joshua baez",
    "jacob reimer", "eduardo tait", "nate george", "justin crawford", "cam collier",
    "chase delauter", "steele hall", "franklin arias", "elian pena", "jojo parker",
    "aroon escobar", "justin gonzales", "a.j. ewing", "angel genao", "josuar gonzalez",
    "george lombard jr.", "braylon payne", "luke adams", "jonathon long", "jhonny level",
    "aron estrada", "spencer jones", "jonny farmelo", "thayron liranzo", "xavier isaac",
    "nelson rada", "esmerlyn valdez", "henry bolte", "brock wilken", "demetrio crisantes",
    "cooper ingle", "jefferson rojas", "josh adamczewski", "dauri fernandez", "felnin celesten",
    "billy carlson", "ethan conrad", "marco dinges", "jeferson quero", "gabriel davalillo",
    "eric bitonti", "braden montgomery", "joe mack", "chase harlan", "bo davidson",
    "slade caldwell", "termarr johnson", "josh hammond", "john gil", "daniel pierce",
    "hao-yu lee", "gavin fien", "roldy brito", "brailer guerrero", "aidan smith",
    "tyson lewis", "ethan holliday", "jeral perez", "jace laviolette", "slater de brun",
    "jaison chourio", "hayden alvarez", "aiva arquette", "juan sanchez", "ching-hsien ko",
    "xavier neyens", "jd dix", "charlie condon", "tre' morgan", "leonardo bernal",
    "brady ebel", "gabriel gonzalez", "abimelec ortiz", "kevin alvarez", "sam antonacci",
    "charles davalan", "yohendrick pinango", "jared thomas", "max anderson", "sean gamble",
    "devin fitz-gerald", "luis cova", "marconi german", "edgar montero", "cole carrigg",
    "austin overn", "ike irish", "jesus baez", "ethan salas", "robert calaz",
    "handelfry encarnacion", "tommy troy", "christopher suero", "elorky rodriguez", "hendry mendez",
    "andrew fischer", "brendan summerhill", "kane kepley", "brandon winokur", "luis arana",
    "jaden fauske", "welbyn francisca", "rj schreck", "pedro ramirez", "roc riggio",
    "johan de los santos", "deniel ortiz", "kayson cunningham", "edwin arroyo", "devin taylor",
    "tai peete", "joseph sullivan", "quentin young", "wilder dalis", "alfonsin rosario",
    "ryan mitchell", "coy james", "lujames groover", "blake burke", "josh owens",
    "victor figueroa", "sam petersen", "ethan frey", "yeremi cabrera", "cristian arguelles",
    "kendall george", "kahlil watson", "brendan jones", "blake mitchell", "blaze jordan",
    "juan ortuno", "cooper flemming", "luke stevenson", "wyatt sanford", "ramon ramirez",
    "kemp alderman", "zach ehrhard", "gavin kilen", "josue brito", "andrew salas",
    "taitn gray", "kala'i rosario", "dorian soto", "nathan flewelling", "enddy azocar",
    "aidan west", "juan brito", "dante nori", "enrique bradfield jr.", "yairo padilla",
    "josiah hartshorn", "axiel plaz", "enrique jimenez", "jadher areinamo", "edward lantigua",
    "mason neville", "cris rodriguez", "angel feliz", "tim piasentin", "jesus rodriguez"
];

// Create ranking lookup map
export const PLAYER_RANKINGS: Map<string, number> = new Map(
    TOP_200_PLAYERS.map((name, idx) => [name.toLowerCase(), idx + 1])
);
