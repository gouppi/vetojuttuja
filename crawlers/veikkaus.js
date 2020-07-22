const endpoint = 'https://www.veikkaus.fi/appapi/ebet?lang=fi&v=2';
const esports = [33, 39, 41, 43, 62];
const colors = require('colors');
const moment = require('moment');
const { checkGameType, findTeamFromInfo, findGame, getDataFromEndpoint, findGameFromDB, updateGameToDB, insertGameToDB } = require('./utils');
const VEIKKAUS = 'veikkaus.fi';

(async () => {
	let response = await getDataFromEndpoint(endpoint, { headers: { 'x-wgate-api-key': 'WWW' } });
	if (!response) {
		return false;
	}

	const games = response.data.events.filter(game => esports.includes(parseInt(game.sportId)));
	for (let i = 0; i < games.length; i++) {
		const game = games[i];

		// TODO: näemmä jotkut peleistä on sellaisia että teams on tyhjä ja esim sportName on kans.

		if (game.competitors.length > 2) {
			console.log(`[INFO]: Peli ei ole moneyline, skipataan toistaiseksi`.red);
			continue;
		}

		let home;
		let away;

		if (game.teams.length === 0) {
			console.log(`[INFO]: Pelillä ei ole teams-avaimessa arvoja`.yellow);
			//console.log(game);
			home = findTeamFromInfo([(game.competitors[0].name)]);
			away = findTeamFromInfo([(game.competitors[1].name)]);
			//continue;
		} else {
			home = findTeamFromInfo([(game.teams[0].name, game.teams[0].shortName)]);
			away = findTeamFromInfo([(game.teams[1].name, game.teams[1].shortName)]);
		}


		// TODO: pitäisikö vaihtaa logiikka kokonaan siten että competitors - kohdasta katsotaan aina nimet?
		let query = {
			sport: findGame(game.sportName),
			home: home && home.hasOwnProperty('names') ? home.names[0].name : home,
			away: away && away.hasOwnProperty('names') ? away.names[0].name : away
		};

		if (!validateData(query)) {
			continue;
		}

		// Try to find saved games from db
		const gameDB = await findGameFromDB(query);
		if (gameDB) {
			let odds = gameDB.odds;
			for (const k in odds) {
				odds[k] = odds[k].filter(g => g.from !== VEIKKAUS);
			}
			odds = buildOdds(game, odds);
			const result = await updateGameToDB({ _id: gameDB._id }, { updatedAt: parseInt(moment().format('X')), odds: odds });
			console.log(`${result.result.ok && "Päivitys onnistui"}`.green);
		} else {
			let data = {
				sport: query.sport,
				home: query.home,
				away: query.away,
				startsAt: game.date / 1000,
				startsAtText: moment(game.date).format(),
				updatedAt: parseInt(moment().format('X')),
				odds: buildOdds(game, {})
			}
			const result = await insertGameToDB(data);
			console.log(`${result.result.ok && "Luonti onnistui"}`.green);
		}
	}
	process.exit(0);
})();

const validateData = (data, game) => {
	console.log(data);
	let clear = true;
	if (!data.sport) {
		console.log(`Sport empty`.red);
		clear = false;
	}
	if (!data.home) {
		//console.log(`Ei löydetty kotijoukkuetta ${game.teams[0].name} / ${game.teams[0].shortName}`.yellow);
		//console.log(`(Vastassa joukkue: ${game.teams[1].name} / ${game.teams[1].shortName})`.gray);
		console.log("Ei löydetty kotijoukkuetta".red);
		clear = false;
	}
	if (!data.away) {
		//console.log(`Ei löydetty vierasjoukkuetta ${game.teams[1].name} / ${game.teams[1].shortName}`.yellow);
		//console.log(`(Vastassa joukkue: ${game.teams[0].name} / ${game.teams[0].shortName})`.gray);
		console.log("Ei löydetty vierasjoukkuetta".red);
		clear = false;
	}
	return clear;
}



const buildOdds = (game,odds) => {
	game.competitors.reduce((acc, comp) => {
		const gameType = checkGameType(comp.id);
		if (null === gameType) {
			console.log(`Pelityyppi: ${game.id} - ei osu mihinkään pelityyppiin.`);
			return acc;
		}

		if (!acc.hasOwnProperty(gameType)) {
			acc[gameType] = [];
		}

		acc[gameType].push({
			type: comp.id,
			from: VEIKKAUS,
			multiplier: comp.odds.odds,
			updatedAt: parseInt(moment().format('X'))
		});
		return acc;
	}, odds);

	return odds;
}