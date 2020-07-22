import React, { useEffect, useState } from 'react'
import Grid from '@material-ui/core/Grid';
import Game from '../components/Game';

const GamesGrid = () => {

    const [games, setGames] = useState([]);


    useEffect(() => {
        const apiUrl = 'http://localhost:3333/api/data';
        fetch(apiUrl).then((response) => response.json())
            .then((data) => {
                setGames(data)
            }
            );
    }, []);



    return (
        <Grid container spacing={1}>
            {games.map((game, i) => {

                let best = {};
                let divider = 0;
                Object.keys(game.odds).forEach(key => {
                    best[key] = game.odds[key][0].multiplier;
                    divider += 100 / game.odds[key][0].multiplier;
                });

                let multiplier = (1 / divider) - 1;

                return (
                    <Grid key={i} item xs={12} multiplier={multiplier} >
                        <Game game={game} defaults={best} />
                    </Grid>
                )
            })}
        </Grid>
    )
}

export default GamesGrid;