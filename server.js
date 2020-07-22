const express = require('express')
const app = express()
const port = 3333
var cors = require('cors')
app.use(cors())

const { findGamesFromDB } = require('./crawlers/utils');

app.get('/api/data', async (req, res) => {
    let data = await findGamesFromDB();
    // for (let i =  0; i < data.length; i++) {
    //     for (const key in data[i].odds) {
    //         data[i].odds[key].sort((a,b) => b.multiplier - a.multiplier);
    //     }
    // }
    res.json(data);
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))