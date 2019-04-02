require('dotenv').config()
const path = require('path')
const fs = require('fs')
const rp = require('request-promise')

async function helloLadok () {
  const pfx = fs.readFileSync(path.resolve(process.cwd(), 'certificate.pfx'))

  console.log('Trying to say hello to Ladok...')

  await rp({
    url: 'https://api.test.ladok.se/kataloginformation/anvandare/autentiserad',
    agentOptions: {
      passphrase: process.env.LADOK_CERTIFICATE_PASSPHRASE,
      pfx,
    }
  })

  console.log('Successful!')
}

helloLadok()
