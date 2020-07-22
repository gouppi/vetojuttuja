import React from 'react'
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';

import GamesGrid from '../components/gamesGrid';

const GamesPage = () => {
    return (
        <Container style={{ marginTop: '3rem' }} maxWidth="lg">
            <Typography variant="h3">Vetovahti v. 2.0</Typography>
                <GamesGrid/>


        </Container>
    );
}

export default GamesPage;