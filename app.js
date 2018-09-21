const fs = require('fs')
const readline = require('readline')
const { google } = require('googleapis')
const MongoClient = require('mongodb').MongoClient
const url = "mongodb://paulfitz:one2345@ds111063.mlab.com:11063/premier-league-18-19"
// Connect to the db
MongoClient.connect(url, { useNewUrlParser: true }, function(err, client) {
  if (err) throw err;
  console.log('Connected')
  const db = client.db('premier-league-18-19')
  // delete the database
  db.dropDatabase(function(err, result){
    console.log(`Error : ${err}`)
    if (err) throw err
    console.log(`Operation Success ${result}`)
    // after all the operations with db, close it.
    client.close()
  })
})

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
      console.log('The API returned an error: ' + err)
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
            console.log('The API returned an error: ' + err);
            return;
          }

          const events = response.data.items
          const teamName = events[i].organizer.displayName

          if(teamName !== undefined && teamName !== 'Contacts') {
            console.log(teamName)
            const team = {
              teamName,
              teamEvents: []
            }

            MongoClient.connect(url, { useNewUrlParser: true }, function(err, client) {
  
              let obj = {
                name: teamName
              };
  
              if (err) throw err;
              const db = client.db('premier-league-18-19');
      
         
              db.collection('teams').insertOne(obj, function(err, res) {
                if (err) throw err;
                console.log("1 document inserted");
                client.close();
              });
              
            });
          }
        })
      }
    }
  })
}