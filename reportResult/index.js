const { getEnv } = require('../lib/env')
const path = require('path')
const fs = require('fs')
const got = require('got')
const inquirer = require('inquirer')

async function helloLadok () {
  const pfx = fs.readFileSync(path.resolve(process.cwd(), 'certificate.pfx'))

  console.log('Trying to say hello to Ladok...')

  await got({
    url: 'https://api.test.ladok.se/kataloginformation/anvandare/autentiserad',
    pfx,
    passphrase: await getEnv('LADOK_CERTIFICATE_PASSPHRASE')
  })

  console.log('Successful!')
}

async function start () {
  const { option } = await inquirer.prompt({
    name: 'option',
    message: 'What do you want to do?',
    type: 'list',
    choices: [
      { name: 'Say hello to Ladok', value: 'helloLadok' }
    ]
  })

  switch (option) {
    case 'helloLadok':
      return helloLadok()
  }
}

start()
