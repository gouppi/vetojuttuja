import React from 'react'
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';

const OddGroup = ({ onChange, symbol, oddGroup }) => {
    const [bet, setBet] = React.useState(0);

    const handleBetChange = (event, newBet) => {
        if (newBet !== null) {
            setBet(newBet);
            console.log(event.target);

            const multiplier = event.target.dataset.multiplier || event.target.parentElement.dataset.multiplier;
            console.log("Multiplier on ", multiplier);
            onChange(multiplier, symbol);
        }
    }

     const buttons = oddGroup.map((odd, i) =>
         <ToggleButton key={i} value={i} data-multiplier={odd.multiplier}>{odd.from} - {odd.multiplier}</ToggleButton>
     );
    return (
        <ToggleButtonGroup
            exclusive
            value={bet}
            onChange={handleBetChange}
            style={{ margin: "1rem" }}
            orientation="horizontal"
            color="primary"
        >
            {buttons}
        </ToggleButtonGroup>
    )

}

export default OddGroup;