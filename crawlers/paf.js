const endpoint = 'https://eu-offering.kambicdn.org/offering/v2018/paf/listView/esports.json?lang=fi_FI&market=FI&client_id=2&channel_id=1&ncid=1593632714433&useCombined=true';
const colors = require('colors');
const moment = require('moment');
const {checkGameType,findTeamFromInfo, findGame, getDataFromEndpoint, findGameFromDB, updateGameToDB, insertGameToDB } = require('./utils');
const PAF = 'paf.com';

(async () => {
	let response = await getDataFromEndpoint(endpoint);
	if (!response) {
		return false;
	}

	const games = response.data.events.filter(game => game.event.state !== 'STARTED');
	for (let i = 0; i < games.length; i++) {
		const game = games[i];

		if (game.betOffers[0].outcomes.length > 2) {
			console.log(`[INFO]: Peli ei ole moneyline, skipataan toistaiseksi`.red);
			continue;
		}

		let home = findTeamFromInfo(Array(game.event.homeName));
		let away = findTeamFromInfo(Array(game.event.awayName));

		let query = {
			sport: findGame(game.event.sport),
			home: home && home.hasOwnProperty('names') ? home.names[0].name : null,
			away: away && away.hasOwnProperty('names') ? away.names[0].name : null
		};

		if (! validateData(query,game)) {
			continue;
		}

		const gameDB = await findGameFromDB(query);
		if (gameDB) {
			// This is really dirty. API returns GMT+0 times, but TZ isn't included in the string.
			let gameStart = moment(game.event.start.replace('Z','+00:00'));
			let dbSaved = moment.unix(gameDB.startsAt);
			if (gameStart.isSame(dbSaved)) {
				let odds =  gameDB.odds;//.filter(g => g.from !== PAF);
				for (const k in odds) {
					odds[k] = odds[k].filter(g => g.from !== PAF);
				}
				odds = buildOdds(game,odds);
				const result = await updateGameToDB({_id: gameDB._id}, {updatedAt: parseInt(moment().format('X')), odds: odds});
				console.log(`${result.result.ok && "Päivitys onnistui"}`.green);
			}
		} else {
			let gameStart = moment(game.event.start.replace('Z','+00:00'));
			let data = {
				sport: query.sport,
				home: query.home,
				away: query.away,
				startsAt: gameStart.unix(),
				startsAtText: gameStart.format(),
				updatedAt: parseInt(moment().format('X')),
				odds: buildOdds(game, {})
			}
			const result = await insertGameToDB(data);
			console.log(`${result.result.ok && "Luonti onnistui"}`.green);
		}
	}
	process.exit(0);
})();

const validateData = (data,game) => {
	let clear = true;
	if (! data.sport) {
		console.log(`Sport empty`.red);
		clear = false;
	}
	if (! data.home) {
		console.log(`Ei löydetty kotijoukkuetta ${game.event.homeName}`.yellow);
		console.log(`(Vastassa joukkue: ${game.event.awayName})`.gray);
		clear = false;
	}
	if (! data.away) {
		console.log(`Ei löydetty vierasjoukkuetta ${game.event.awayName} `.yellow);
		console.log(`(Vastassa joukkue: ${game.event.homeName})`.gray);
		clear = false;
	}
	return clear;
}




const buildOdds = (game,odds) => {
	game.betOffers[0].outcomes.reduce((acc, comp) => {
		const gameType = checkGameType(comp.label);
		if (null === gameType) {
			console.log(`Pelityyppi: ${game.label} - ei osu mihinkään pelityyppiin.`);
			return acc;
		}

		if (! acc.hasOwnProperty(gameType)) {
			acc[gameType] = [];
		}

		acc[gameType].push({
			type: comp.label,
			from: PAF,
			multiplier: comp.odds / 10,
			updatedAt: parseInt(moment().format('X'))
		});
		return acc;
	}, odds);

	return odds;
}