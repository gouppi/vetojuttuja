const { getDataFromEndpoint, insertManyGamesToDB, removeAllGamesFromDB } = require('./utils');
require('colors');
const moment = require('moment');
const stringSimilarity = require('string-similarity');

// TODO Tähän kohti rakennetaan geneerinen mappaus kaikista urheilutyypeistä. Tarvitaan sitten frontissa kun halutaan filtteröidä vain tiettyjä pelityyppejä näkyviin.
const sportNameMap = {
    'E-urheilu': 'Esports',
    'Baseball': 'Pesäpallo',
}

/**
 * Processes JSON data from Veikkaus API
 * @param {JSON} raw_data
 */
const processVeikkausData = async (raw_data) => {
    let cleaned_data = [];
    const gameURL = 'https://www.veikkaus.fi/fi/pitkaveto?eventView=games&eventId=%%GAMEID%%&sportId=%%SPORTID%%';

    raw_data.data.events = raw_data.data.events.filter(event => event.sportName !== 'Arvontapelit' && event.competitors.length <= 3 && event.description.length === 0)
    for (let i = 0; i < raw_data.data.events.length; i++) {
        const row = raw_data.data.events[i];

        let betterNames = {};
        if (row.teams.length > 0) {
            for (let k = 0; k < row.teams.length; k++) {
                if (row.teams[k].hasOwnProperty('name') && row.teams[k].hasOwnProperty('shortName')) {
                    betterNames[row.teams[k].shortName] = row.teams[k].name
                }
            }
        }

        let dataObj = {
            homeName: betterNames.hasOwnProperty(row.competitors[0].name) ? betterNames[row.competitors[0].name] : row.competitors[0].name,
            awayName: betterNames.hasOwnProperty(row.competitors[1].name) ? betterNames[row.competitors[1].name] : row.competitors[1].name,
            odds: {
                [row.type]: {
                    home: row.competitors[0].odds.odds,
                    away: row.competitors[1].odds.odds,
                    gameUrl: gameURL.replace('%%GAMEID%%', row.id).replace('%%SPORTID%%', row.sportId)
                }
            },
            sportName: row.sportName,
            dateUnix: moment(row.date).unix()
        }
        if (row.competitors.length > 2) {
            dataObj.odds[row.type].even = row.competitors[2].odds.odds;
        }
        cleaned_data.push(dataObj);
    }
    return cleaned_data;
}

/**
 * Processes JSON data from PAF API
 * @param {JSON} raw_data
 */
const processPafData = async (raw_data) => {
    let cleaned_data = [];

    raw_data.data.events = raw_data.data.events.filter(event => event.event.sport !== 'NASCAR').filter(event => event.event.state !== 'STARTED').filter(event => event.betOffers.length > 0);
    for (let i = 0; i < raw_data.data.events.length; i++) {
        const row = raw_data.data.events[i];
        let odds = {
            '1': null,
            '2': null,
            'X': null
        };
        let type;
        // Hard coded shit here now, in future perhaps loop all betOffers through and map them all to odds object?
        for (let i = 0; i < row.betOffers[0].outcomes.length; i++) {
            const odd = row.betOffers[0].outcomes[i];
            let label = odd.label;
            if (isNaN(odd.label)) {
                if (odd.label === row.event.homeName) {
                    label = '1';
                } else if (odd.label === row.event.awayName) {
                    label = '2';
                } else if (row.betOffers[0].outcomes.length > 2) {
                    label = 'X';
                } else {
                    console.log(`WTF WTF warning, row outcome label mismatch, tämä: ${odd.label} ei osu kumpaankaan näistä: ${row.event.homeName} - tai - ${row.event.awayname}`.bgRed);
                    continue;
                }
            }
            odds[label] = parseInt(odd.odds) / 10;
            type = i === 1 ? '12' : i === 2 ? '1X2' : 'wtf';
        }
        let dataObj = {
            homeName: row.event.homeName,
            awayName: row.event.awayName,
            odds: {
                [type]: {
                    home: odds['1'],
                    away: odds['2'],
                    gameUrl: row.event.path.reduce((acc, p) => acc + '/' + p.termKey, 'https://www.paf.com/betting#/filter') + '/' + row.event.id
                }
            },
            sportName: row.event.path[0].name,
            dateUnix: moment(row.event.start).unix()
        }
        if (row.betOffers[0].outcomes.length > 2) {
            dataObj.odds[type].even = odds['X'];
        }
        cleaned_data.push(dataObj);
    }
    return cleaned_data;
}

// TODO: TOO TIRED NOW TO THINK THIS; THE DATA HERE IS HORRIBLE
const processBetssonData = async (endpoint, headers) => {
    let cleaned_data = [];
    const betsson_game_url = 'https://www.betsson.com/en/sportsbook/';
    const oddGroups = {
        'MW2W': '12',
        'MW3W': '1X2'
    };

    const labels = {
        'HOME': 'home',
        'AWAY': 'away',
        'DRAW': 'even'
    }

    // TÄHÄN PITÄÄ NYT RAKENTAA JOKU LOOPPAUS_METODI JOKA OSAA HAKEA N - KERTAA DATAN RAJAPINNASTA
    const iterateAndReCall = async (cleaned_data, endpoint, headers) => {
        let raw_data = await getDataFromEndpoint(endpoint, headers);

        const markets = raw_data.data.data.markets.filter(market => market.id.endsWith('MW2W') || market.id.endsWith('MW3W')).reduce((acc, market) => {
            const group = market.id.endsWith('MW2W') ? '12' : market.id.endsWith('MW3W') ? '1X2' : 'wtf';
            if (!acc.hasOwnProperty(market.eventId)) {
                acc[market.eventId] = {};
            }
            if (!acc[market.eventId].hasOwnProperty(group)) {
                acc[market.eventId][group] = null;
            }
            acc[market.eventId][group] = market.id;
            return acc;
        }, {});

        for (let i = 0; i < raw_data.data.data.events.length; i++) {
            const row = raw_data.data.data.events[i];
            let game_odds = {};
            if (!markets.hasOwnProperty(row.id)) {
                console.log("Marketsin sisällä ei ole id:tä ", row.id);
                continue;
            }

            for (const [game_type, market_id] of Object.entries(markets[row.id])) {
                let game_type_odds = {
                    gameUrl: betsson_game_url + row.slug + '?mtg=all&eti=0'
                };
                let odds = raw_data.data.data.selections.filter(selection => selection.marketId === market_id);
                if (!odds.length) {
                    continue;
                }
                odds.forEach(odd => {
                    if (labels.hasOwnProperty(odd.selectionTemplateId)) {
                        game_type_odds[labels[odd.selectionTemplateId]] = Math.floor(odd.odds * 100);
                    }
                });
                game_odds[game_type] = game_type_odds;
            }

            let dataObj = {
                homeName: row.participants[0].label,
                awayName: row.participants[1].label,
                odds: game_odds,
                sportName: row.categoryName,
                dateUnix: moment(row.startDate).unix()
            }
            cleaned_data.push(dataObj);
        }

        if (raw_data.data.data.page < raw_data.data.data.totalPages) {
            endpoint = endpoint.replace(/(?<=pageNumber=)\d+/gm, ++raw_data.data.data.page);
            cleaned_data = iterateAndReCall(cleaned_data, endpoint, headers);
        }
        return cleaned_data;
    };

    let now = moment().add(1, 'days');
    now.set('hour', 23);
    now.set('minute', 59);
    now.set('second', 59);
    now.utcOffset(0);
    endpoint += '&startsBefore=' + now.format('YYYY-MM-DDTHH:mm:ss') + 'Z';
    let total_data = await iterateAndReCall(cleaned_data, endpoint, headers);
    return total_data;
}

const endpoints = [
    {
        name: "VEIKKAUS",
        dedicated: false,
        endpoint: "https://www.veikkaus.fi/appapi/ebet?lang=fi&v=2",
        headers: { headers: { 'x-wgate-api-key': 'WWW' } },
        datamap: processVeikkausData
    },
    {
        name: "PAF",
        dedicated: false,
        endpoint: "https://eu-offering.kambicdn.org/offering/v2018/paf/listView/american_football,baseball,basketball,beach_volleyball,boxing,esports,football,ice_hockey,handball,hockey,tennis,volleyball/starting_soon.json?market=FI&lang=fi_FI",
        headers: null,
        datamap: processPafData
    },
    {
        name: "BETSSON",
        dedicated: true,
        endpoint: "https://obgapi.bpsgameserver.com/api/sb/v1/widgets/events-table/v2?pageNumber=1&eventPhase=Prematch&eventSortBy=StartDate&maxMarketCount=2",
        headers: { headers: { brandid: 'e123be9a-fe1e-49d0-9200-6afcf20649af', marketcode: 'en' } },
        datamap: processBetssonData
    }
];


/**
 * Fetches data from apis
 * Sends fetched data to cleaner function for mapping
 */
const fetchDataFromAPIs = async () => {
    const data = [];
    for (let i = 0; i < endpoints.length; i++) {
        console.log(`Käsitellään rajapintaa ${endpoints[i].name}`);
        let cleaned_data;
        // This casino handles data fetching differently, let it handle it.
        if (endpoints[i].dedicated) {
            cleaned_data = await endpoints[i].datamap(endpoints[i].endpoint, endpoints[i].headers);
        } else {
            let response = await getDataFromEndpoint(endpoints[i].endpoint, endpoints[i].headers);
            if (!response) {
                console.log(`Rajapinta ${endpoints[i].name} ei palauttanut dataa`.red);
                return false;
            }
            cleaned_data = await endpoints[i].datamap(response);
        }

        data.push({ name: endpoints[i].name, data: cleaned_data });
    }
    return data;
}

/**
 * This function is quite horrible but still awesome.
 * casinos is an array of objects containing data from every casino we crawl.
 * We start combining matching games from separate casinos together by comparing the given game_row with remaining casino data rows.
 * Hence we need such deep iterating.
 * first iteration = loop through all casinos in casinos-array
 * second iteration = loop through all data rows (= games) in that particular casino
 * Then we start comparing the given game "game_row" with every casino game row and try to match corresponding games to each other.
 *
 * @param {*} game_row
 * @param {*} casinos
 */
const getMatchingBets = (game_row, casinos) => {
    let odds_combined = {};
    for (let j = 0; j < casinos.length; j++) {
        const casino_against = casinos[j];
        for (let k = 0; k < casino_against.data.length; k++) {
            const game_against = casino_against.data[k];

            // This game isn't even held on same date as the first casino, skip it.
            if (game_against.dateUnix !== game_row.dateUnix) {
                continue;
            }

            let game_match = game_row.homeName + ' - ' + game_row.awayName;
            let against_match = game_against.homeName + ' - ' + game_against.awayName;
            let against_match_reverse = game_against.awayName + ' - ' + game_against.homeName;

            const similarity_value = stringSimilarity.compareTwoStrings(game_match, against_match);
            const similarity_reverse_value = stringSimilarity.compareTwoStrings(game_match, against_match_reverse);
            if (similarity_value > 0.4 || similarity_reverse_value > 0.4) {
                let home_home = stringSimilarity.compareTwoStrings(game_row.homeName, game_against.homeName);
                let home_away = stringSimilarity.compareTwoStrings(game_row.homeName, game_against.awayName);
                let away_home = stringSimilarity.compareTwoStrings(game_row.awayName, game_against.homeName);
                let away_away = stringSimilarity.compareTwoStrings(game_row.awayName, game_against.awayName);

                // If the home team doesn't match to the opposing casino teams (Either home or away) - we can be sure that this match doesn't have the same teams.
                if (home_home < 0.55 && home_away < 0.55) {
                    continue;
                }
                if (away_home < 0.55 && away_away < 0.55) {
                    continue;
                }

                let reversed = false;
                if (home_away > home_home) {
                    reversed = true;
                }

                // Now we have similar games here. lets combine odd types together
                for (const [game_type, odds] of Object.entries(game_against.odds)) {
                    if (!odds_combined.hasOwnProperty(game_type)) {
                        odds_combined[game_type] = [];
                    }

                    let o = {
                        casino: casino_against.name,
                        reversed: reversed,
                        home: reversed ? odds.away : odds.home,
                        away: reversed ? odds.home : odds.away,
                        homeName: reversed ? game_against.awayName : game_against.homeName,
                        awayName: reversed ? game_against.homeName : game_against.awayName,
                        gameUrl: odds.gameUrl
                    };
                    if (odds.hasOwnProperty('even')) {
                        o.even = odds.even;
                    }

                    odds_combined[game_type].push(o);
                }
            }
        }
    }
    return odds_combined;
}
/**
 * We crawl game data from every endpoint we have defined by calling fetchDataFromAPIs
 * we then shift every casino individually, and start comparing its games to the remaining casinos we have
 * by calling getMatchingBets with game_row and the remaining casinos and their data.
 */
(async function () {
    const casinos = await fetchDataFromAPIs();
    let matches = [];
    while (casinos.length > 1) {
        const casino = casinos.shift();
        for (let i = 0; i < casino.data.length; i++) {
            const game_row = casino.data[i];
            const odds_combined = getMatchingBets(game_row, casinos);
            // If we end up with zero matches, do not proceed any further.
            // No point of showing data from single casino to end user, win-percentage will definitely be low.
            if (Object.keys(odds_combined).length === 0) {
                continue;
            }

            for (const [game_type, odds] of Object.entries(game_row.odds)) {
                if (!odds_combined.hasOwnProperty(game_type)) {
                    continue;
                }
                let o = {
                    ...odds,
                    casino: casino.name,
                    reversed: false,
                    homeName: game_row.homeName,
                    awayName: game_row.awayName
                };

                odds_combined[game_type].push(o);
            }

            let best_percent;
            for (const [game_type, odds] of Object.entries(odds_combined)) {
                let percent = 0;
                ['home', 'away', 'even'].forEach(k => {
                    percent += Math.min.apply(Math, odds.map(o => { return o.hasOwnProperty(k) ? 100 / o[k] : 0 }));
                });
                percent = ((1 / percent) - 1) * 100;
                if (isNaN(best_percent) || percent > best_percent) {
                    best_percent = percent;
                }
            }

            matches.push({
                homeName: game_row.homeName,
                awayName: game_row.awayName,
                foundFrom: casino.name,
                dateUnix: game_row.dateUnix,
                sportName: game_row.sportName,
                odds: odds_combined,
                percentage: best_percent
            });
        }
    }

    matches.sort((a, b) => b.percentage - a.percentage);
    matches.forEach((match) => {
        //    console.log(match);
        //    console.log(match.odds);
    });
    //console.log(`${matches.length} löydettyä peliä.`)
    await removeAllGamesFromDB();
    let response = await insertManyGamesToDB(matches);
    //console.log("Tallennus lähtee käyntiin ja vastaus oli ", response);
    process.exit();

    // fs.writeFile('data.json', JSON.stringify(matches), function (err) {
    //     if (err) return console.log(err);
    //     console.log('Hello World > data.json');
    //   });a

})();