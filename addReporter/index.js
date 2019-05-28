const { getEnv } = require('../lib/env')
const fs = require('fs')

const Ladok = require('@kth/ladok-api')
const inquirer = require('inquirer')

async function addPermission (ladok, anvandareUID) {
  const { organisationUID } = await inquirer.prompt({
    message: 'Write the Organisation UID',
    name: 'organisationUID',
    type: 'input'
  })

  await ladok.requestUrl('/resultat/resultatrattighet/organisation/rapportor', 'POST', {
    'SkapaOrganisationsrattighet': [{
      "AnvandareUID": anvandareUID,
      "Informationsbehorighetsavgransningar": [],
      "OrganisationUID": organisationUID,
      "RattighetenAvser": "HEL_KURS_OCH_MODUL_RESULTAT"
    }]
  })
}

async function removePermission (ladok, rattighet) {
  await ladok.requestUrl(`/resultat/resultatrattighet/${rattighet.Uid}`, 'DELETE')
}

;(async function start () {
  const ladok = Ladok(
    await getEnv('LADOK_API_URL'),
    {
      pfx: fs.readFileSync('./certificate.pfx'),
      // pfx: Buffer.from(await getEnv('LADOK_PFX_BASE64')),
      passphrase: await getEnv('LADOK_CERTIFICATE_PASSPHRASE')
    }
  )

  console.log('With this script, you can add "rapportör" rights ("rättigheter") to a user...')
  const { anvandareUID } = await inquirer.prompt({
    message: 'Write the Användare UID',
    name: 'anvandareUID',
    type: 'input'
  })

  while (true) {
    const { body: rights } = await ladok.requestUrl('/resultat/resultatrattighet/resultatrattighet/rapportor/sok', 'PUT', {
      'AnvandareUID': anvandareUID,
      'Limit': 100,
      'Page': 1,
      'Medarbetartyp': 'RAPPORTOR'
    })

    const options = [
      { name: 'Add new permission', value: 'add' },
      new inquirer.Separator(),
      ...rights.Resultat.map(r => ({
        name: 'Delete for org.' + r.Benamning,
        value: r
      }))
    ]

    const { chosenOption } = await inquirer.prompt({
      type: 'list',
      message: 'What do you want to do? (Ctrl-C to exit)',
      name: 'chosenOption',
      choices: options,
    })

    if (chosenOption === 'add') {
      await addPermission(ladok, anvandareUID)
    } else {
      await removePermission(ladok, chosenOption)
    }
  }
})()
