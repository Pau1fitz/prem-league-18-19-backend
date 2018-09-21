const fs = require('fs')
const readline = require('readline')
const { google } = require('googleapis')
const MongoClient = require('mongodb').MongoClient
const url = "mongodb://paulfitz:one2345@ds111063.mlab.com:11063/premier-league-18-19"

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
const TOKEN_PATH = 'token.json'

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listEvents);
})

const authorize = (credentials, callback) => {
  const {client_secret, client_id, redirect_uris} = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0])

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  })
}

const getAccessToken = (oAuth2Client, callback) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close()
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err)
      oAuth2Client.setCredentials(token)
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err)
        console.log('Token stored to', TOKEN_PATH)
      })
      callback(oAuth2Client)
    })
  })
}

const listEvents = auth => {

  // Connect to the db
  MongoClient.connect(url, { useNewUrlParser: true }, function(err, client) {
    if (err) throw err;
    console.log('Connected')
    const db = client.db('premier-league-18-19')
    // delete the database
    db.dropDatabase(function(err, result){
      if (err) throw err
      console.log(`Database Dropped Success ${result}`)

      const calendar = google.calendar('v3');
      calendar.calendarList.list({
        auth,
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      }, (err, response) => {
        if (err) {
          console.log(`The API returned an error: ${err}`)
          return
        }
    
        const events = response.data.items
    
        if (events.length == 0) {
          console.log('No upcoming events found.')
        } else {
          for (let i = 0; i < events.length; i++) {
            calendar.events.list({
              auth,
              calendarId: events[i].id,
              timeMin: (new Date('2018/06/12')).toISOString(),
              maxResults: 2500,
              singleEvents: true,
              orderBy: 'startTime'
            }, (err, response) => {
              if (err) {
                console.log('The API returned an error: ' + err)
                return
              }
    
              const events = response.data.items
              const teamName = events[i].organizer.displayName
    
              if (teamName !== undefined && teamName !== 'Contacts') {  
                const obj = {
                  teamName
                }

                if (err) throw err;
                db.collection('teams').insertOne(obj, function(err, res) {
                  if (err) throw err;
                  console.log(`${teamName} inserted`);
                })
              }
    
              if (events.length == 0) {
                console.log('No upcoming events found.');
              } else if(events[i].organizer.displayName && events[i].organizer.displayName.length > 0){ 
      
                for (let i = 0; i < events.length; i++) {
                  if(events[i].organizer.displayName !== 'Contacts') {
                    let event = events[i]
                    let game = event.summary
                    if(game.includes('[')){
                      continue;
                    }
      
                    let start = event.start.dateTime || event.start.date
                    let opponent = event.summary.split('-').filter(team => !team.includes(teamName))[0].split('(')[0].trim()
                    let home_or_away = event.summary.split('-')[0].includes(teamName) ? 'home' : 'away'
                    let score = game.includes('(') ? game.split(' ').slice(-1)[0].replace(/\(|\)/g,'') : ''
                    let winLossDraw
                    if(score.split('-').length > 0) {
                      winLossDraw = home_or_away === 'home' && parseInt(score.split('-')[0]) > parseInt(score.split('-')[1]) ? 'won' :
                        home_or_away === 'away' && parseInt(score.split('-')[1]) > parseInt(score.split('-')[0]) ? 'won' :
                        parseInt(score.split('-')[1]) == parseInt(score.split('-')[0]) ? 'draw' :
                        score.split('-').length == 1 ? '' : 'lost'
                    }
    
                    const teamDataObj = {
                      game,
                      start,
                      opponent,
                      home_or_away,
                      score,
                      winLossDraw
                    }
              
                    if (err) throw err;
                    const db = client.db('premier-league-18-19')
                    db.collection(teamName).insertOne(teamDataObj, function(err, res) {
                      if (err) throw err
                      console.log(`${JSON.stringify(teamDataObj)} inserted`)
                    })                   
                  }
                }
              }
            })
          }
        }
      })
    })

    // close client when close program
    process.on('SIGINT', function() {
      client.close()
    })
  })
}
