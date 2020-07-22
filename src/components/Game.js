import React, {useEffect} from 'react'
import Typography from '@material-ui/core/Typography';
import OddGroup from './OddGroup';
import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';
const Game = ({ game,defaults }) => {

    const [multipliers, setMultipliers] = React.useState(defaults);
    const [percentage, setPercentage] = React.useState();

    const toggleMultipliers = (multiplier, key) => {
        console.log("ToggleMultipliers, ", key, multiplier);
        let obj = {};
        obj[key] = multiplier;
        console.log("Obj",obj);
        setMultipliers({...multipliers, ...obj});
    }

    useEffect(() => {
        console.log("Multipliers muuttui");
        console.log(multipliers);
        let newPercent = (1 / (Object.values(multipliers)
            .reduce((acc, multiplier) => {
                acc += 100 / multiplier;
                return acc;
            },0))) - 1;
            console.log("Uusi tuottoprosentti: ", newPercent);
            setPercentage(parseFloat(newPercent * 100).toFixed(2));
    }, [multipliers]);

    let date = new Date(0);
    date.setUTCSeconds(game.dateUnix);


    return (
        <Paper variant="outlined" square style={{padding:"1rem"}}    >

            <Typography>{game.homeName} - {game.awayName}</Typography>
            <Typography>{game.sportName}</Typography>
            <Typography>{date.toLocaleString()}</Typography>
            <Typography variant="h5">Voittoprosentti: {game.percentage}</Typography>
            <Box style={{display:'flex', flexDirection:'row', justifyContent:'left', alignItems:'center'}}>
                {Object.keys(game.odds).map((oddGroup,i) => (
                    <Box key={i} style={{display:'flex',flexDirection:'column',justifyContent:'center', alignItems:'center'}}>
                        <Typography>{oddGroup}</Typography>
                       {Object.values(game.odds[oddGroup]).map((odd) => (
                           <Box style={{display:'flex'}}>

                           </Box>
                            )
                        )}
                        {/* <OddGroup onChange={toggleMultipliers} symbol={oddGroup} oddGroup={game.odds[oddGroup]} /> */}
                    </Box>
                ))}
            </Box>
        </Paper>
    )
}

export default Game;