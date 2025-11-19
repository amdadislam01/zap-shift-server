const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 3000


// Middleware
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Zap is shifting !')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
